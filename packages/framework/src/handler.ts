import { createHmac } from 'node:crypto';

import { Client } from './client';
import {
  ErrorCodeEnum,
  GetActionEnum,
  HttpHeaderKeysEnum,
  HttpMethodEnum,
  HttpQueryKeysEnum,
  HttpStatusEnum,
  PostActionEnum,
  SIGNATURE_TIMESTAMP_TOLERANCE,
} from './constants';
import {
  NovuError,
  InvalidActionError,
  MethodNotAllowedError,
  MissingApiKeyError,
  PlatformError,
  SignatureExpiredError,
  SignatureInvalidError,
  SignatureMismatchError,
  SignatureNotFoundError,
  SigningKeyNotFoundError,
} from './errors';
import { Awaitable, DiscoverWorkflowOutput } from './types';

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface ServeHandlerOptions {
  client?: Client;
  workflows: Array<DiscoverWorkflowOutput>;
}

interface INovuRequestHandlerOptions<Input extends any[] = any[], Output = any> extends ServeHandlerOptions {
  frameworkName: string;
  client?: Client;
  workflows: Array<DiscoverWorkflowOutput>;
  handler: Handler<Input, Output>;
}

type Handler<Input extends any[] = any[], Output = any> = (...args: Input) => HandlerResponse<Output>;

type HandlerResponse<Output = any> = {
  body: () => Awaitable<any>;
  headers: (key: string) => Awaitable<string | null | undefined>;
  method: () => Awaitable<string>;
  queryString?: (key: string, url: URL) => Awaitable<string | null | undefined>;
  url: () => Awaitable<URL>;
  transformResponse: (res: IActionResponse<string>) => Output;
};

interface IActionResponse<TBody extends string = string> {
  status: number;
  headers: Record<string, string>;
  body: TBody;
}

export class NovuRequestHandler<Input extends any[] = any[], Output = any> {
  public readonly frameworkName: string;

  public readonly handler: Handler;

  public readonly client: Client;

  private readonly hmacEnabled: boolean;

  constructor(options: INovuRequestHandlerOptions<Input, Output>) {
    this.handler = options.handler;
    this.client = options.client ? options.client : new Client();
    this.client.addWorkflows(options.workflows);
    this.frameworkName = options.frameworkName;
    this.hmacEnabled = this.client.strictAuthentication;
  }

  public createHandler(): (...args: Input) => Promise<Output> {
    return async (...args: Input) => {
      const actions = await this.handler(...args);
      const actionResponse = await this.handleAction({
        actions,
      });

      return actions.transformResponse(actionResponse);
    };
  }

  private getStaticHeaders(): Partial<Record<HttpHeaderKeysEnum, string>> {
    const sdkVersion = `novu-framework:v${this.client.version}`;

    return {
      [HttpHeaderKeysEnum.CONTENT_TYPE]: 'application/json',
      [HttpHeaderKeysEnum.ACCESS_CONTROL_ALLOW_ORIGIN]: '*',
      [HttpHeaderKeysEnum.ACCESS_CONTROL_ALLOW_METHODS]: 'GET, POST',
      [HttpHeaderKeysEnum.ACCESS_CONTROL_ALLOW_HEADERS]: '*',
      [HttpHeaderKeysEnum.ACCESS_CONTROL_MAX_AGE]: '604800',
      [HttpHeaderKeysEnum.FRAMEWORK]: this.frameworkName,
      [HttpHeaderKeysEnum.USER_AGENT]: sdkVersion,
      [HttpHeaderKeysEnum.SDK_VERSION]: sdkVersion,
    };
  }

  private createResponse<TBody extends string = string>(
    status: number,
    body: any,
    headers: Record<string, string> = {}
  ): IActionResponse<TBody> {
    return {
      status,
      body: JSON.stringify(body) as TBody,
      headers: {
        ...this.getStaticHeaders(),
        ...headers,
      },
    };
  }

  private createError<TBody extends string = string>(error: NovuError): IActionResponse<TBody> {
    return {
      status: error.statusCode,
      body: JSON.stringify({
        message: error.message,
        data: error.data,
        code: error.code,
      }) as TBody,
      headers: this.getStaticHeaders(),
    };
  }

  private async handleAction({ actions }: { actions: HandlerResponse<Output> }): Promise<IActionResponse> {
    const url = await actions.url();
    const method = await actions.method();
    const action = url.searchParams.get(HttpQueryKeysEnum.ACTION) || '';
    const workflowId = url.searchParams.get(HttpQueryKeysEnum.WORKFLOW_ID) || '';
    const stepId = url.searchParams.get(HttpQueryKeysEnum.STEP_ID) || '';
    const signatureHeader = (await actions.headers(HttpHeaderKeysEnum.SIGNATURE)) || '';
    const anonymousHeader = (await actions.headers(HttpHeaderKeysEnum.ANONYMOUS)) || '';
    const source = url.searchParams.get(HttpQueryKeysEnum.SOURCE) || '';

    let body: Record<string, unknown> = {};
    try {
      if (method === HttpMethodEnum.POST) {
        body = await actions.body();
      }
    } catch (error) {
      // NO-OP - body was not provided
    }

    try {
      if (action !== GetActionEnum.HEALTH_CHECK) {
        this.validateHmac(body, signatureHeader);
      }

      const postActionMap = this.getPostActionMap(body, workflowId, stepId, action, anonymousHeader, source);
      const getActionMap = this.getGetActionMap(workflowId, stepId);

      if (method === HttpMethodEnum.POST) {
        return await this.handlePostAction(action, postActionMap);
      }

      if (method === HttpMethodEnum.GET) {
        return await this.handleGetAction(action, getActionMap);
      }

      if (method === HttpMethodEnum.OPTIONS) {
        return this.createResponse(
          HttpStatusEnum.OK,
          {},
          {
            ...this.getStaticHeaders(),
          }
        );
      }
    } catch (error) {
      return this.handleError(error);
    }

    return this.createError(new MethodNotAllowedError(method));
  }

  private getPostActionMap(
    body: any,
    workflowId: string,
    stepId: string,
    action: string,
    anonymousHeader: string,
    source: string
  ): Record<PostActionEnum, () => Promise<IActionResponse>> {
    return {
      [PostActionEnum.EXECUTE]: async () => {
        const result = await this.client.executeWorkflow({
          ...body,
          workflowId,
          stepId,
          action,
        });

        return this.createResponse(HttpStatusEnum.OK, result, {
          [HttpHeaderKeysEnum.EXECUTION_DURATION]: result.metadata.duration.toString(),
        });
      },
      [PostActionEnum.PREVIEW]: async () => {
        const result = await this.client.executeWorkflow({
          ...body,
          workflowId,
          stepId,
          action,
        });

        return this.createResponse(HttpStatusEnum.OK, result, {
          [HttpHeaderKeysEnum.EXECUTION_DURATION]: result.metadata.duration.toString(),
        });
      },
    };
  }

  private getGetActionMap(workflowId: string, stepId: string): Record<GetActionEnum, () => Promise<IActionResponse>> {
    return {
      [GetActionEnum.DISCOVER]: async () => {
        const result = await this.client.discover();

        return this.createResponse(HttpStatusEnum.OK, result);
      },
      [GetActionEnum.HEALTH_CHECK]: async () => {
        const result = await this.client.healthCheck();

        return this.createResponse(HttpStatusEnum.OK, result);
      },
      [GetActionEnum.CODE]: async () => {
        const result = await this.client.getCode(workflowId, stepId);

        return this.createResponse(HttpStatusEnum.OK, result);
      },
    };
  }

  private async handlePostAction(
    action: string,
    postActionMap: Record<PostActionEnum, () => Promise<IActionResponse>>
  ): Promise<IActionResponse> {
    if (Object.values(PostActionEnum).includes(action as PostActionEnum)) {
      const actionFunction = postActionMap[action as PostActionEnum];

      return actionFunction();
    } else {
      throw new InvalidActionError(action, PostActionEnum);
    }
  }

  private async handleGetAction(
    action: string,
    getActionMap: Record<GetActionEnum, () => Promise<IActionResponse>>
  ): Promise<IActionResponse> {
    if (Object.values(GetActionEnum).includes(action as GetActionEnum)) {
      const actionFunction = getActionMap[action as GetActionEnum];

      return actionFunction();
    } else {
      throw new InvalidActionError(action, GetActionEnum);
    }
  }

  private isClientError(error: unknown): error is NovuError {
    return Object.values(ErrorCodeEnum).includes((error as NovuError).code);
  }

  private handleError(error: unknown): IActionResponse {
    if (this.isClientError(error)) {
      if (error.statusCode === HttpStatusEnum.INTERNAL_SERVER_ERROR) {
        // eslint-disable-next-line no-console
        console.error(error);
      }

      return this.createError(error);
    } else {
      // eslint-disable-next-line no-console
      console.error(error);

      return this.createError(new PlatformError());
    }
  }

  private validateHmac(payload: unknown, hmacHeader: string | null): void {
    if (!this.hmacEnabled) return;
    if (!hmacHeader) {
      throw new SignatureNotFoundError();
    }

    if (!this.client.apiKey) {
      throw new SigningKeyNotFoundError();
    }

    const [timestampPart, signaturePart] = hmacHeader.split(',');
    if (!timestampPart || !signaturePart) {
      throw new SignatureInvalidError();
    }

    const [timestamp, timestampPayload] = timestampPart.split('=');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [signatureVersion, signaturePayload] = signaturePart.split('=');

    if (Number(timestamp) < Date.now() - SIGNATURE_TIMESTAMP_TOLERANCE) {
      throw new SignatureExpiredError();
    }

    const localHash = this.hashHmac(this.client.apiKey as string, `${timestampPayload}.${JSON.stringify(payload)}`);

    const isMatching = localHash === signaturePayload;

    if (!isMatching) {
      throw new SignatureMismatchError();
    }
  }

  private hashHmac(apiKey: string, data: string): string {
    return createHmac('sha256', apiKey).update(data).digest('hex');
  }
}
