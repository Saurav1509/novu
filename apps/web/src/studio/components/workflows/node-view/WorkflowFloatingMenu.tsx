import { Tooltip } from '@novu/design-system';
import { IconButton, LocalizedMessage, Text, type CoreProps, type IconButtonProps } from '@novu/novui';
import { css, cx } from '@novu/novui/css';
import {
  IconOutlineAutoAwesomeMotion,
  IconOutlineAvTimer,
  IconOutlineEmail,
  IconOutlineForum,
  IconOutlineMobileFriendly,
  IconOutlineNotifications,
  IconOutlineSms,
  IconOutlineBolt,
  IconType,
} from '@novu/novui/icons';
import { VStack } from '@novu/novui/jsx';
import { vstack } from '@novu/novui/patterns';
import { FC, PropsWithChildren, useState } from 'react';
import { DocsModal } from '../../../../components/docs/DocsModal';

type IWorkflowFloatingMenuProps = CoreProps;

export const WorkflowFloatingMenu: FC<IWorkflowFloatingMenuProps> = ({ className }) => {
  const [docsOpen, setDocsOpen] = useState<boolean>(false);
  const [path, setPath] = useState<string>('');

  const toggle = () => {
    setDocsOpen((prevOpen) => !prevOpen);
  };

  const handleClick = (pathToSet: string) => () => {
    setPath('echo/steps/' + pathToSet);
    toggle();
  };

  return (
    <>
      <menu className={cx(vstack({ display: 'flex !important', gap: '150', p: '25' }), className)}>
        <WorkflowFloatingMenuSection title="Actions">
          <WorkflowFloatingMenuButton
            Icon={IconOutlineAutoAwesomeMotion}
            tooltipLabel="Guide of how to add a Digest step for embedding in code"
            onClick={handleClick('digest')}
          />
          <WorkflowFloatingMenuButton
            Icon={IconOutlineAvTimer}
            tooltipLabel="Guide of how to add a Delay step for embedding in code"
            onClick={handleClick('delay')}
          />
        </WorkflowFloatingMenuSection>
        <WorkflowFloatingMenuSection title="Channels">
          <WorkflowFloatingMenuButton
            Icon={IconOutlineNotifications}
            tooltipLabel="Guide of how to add an In-app step for embedding in code"
            onClick={handleClick('in-app')}
          />
          <WorkflowFloatingMenuButton
            Icon={IconOutlineEmail}
            tooltipLabel="Guide of how to add an Email step for embedding in code"
            onClick={handleClick('email')}
          />
          <WorkflowFloatingMenuButton
            Icon={IconOutlineSms}
            tooltipLabel="Guide of how to add an SMS step for embedding in code"
            onClick={handleClick('sms')}
          />
          <WorkflowFloatingMenuButton
            Icon={IconOutlineMobileFriendly}
            tooltipLabel="Guide of how to add a Push step for embedding in code"
            onClick={handleClick('push')}
          />
          <WorkflowFloatingMenuButton
            Icon={IconOutlineForum}
            tooltipLabel="Guide of how to add a Chat step for embedding in code"
            onClick={handleClick('chat')}
          />
          <WorkflowFloatingMenuButton
            Icon={IconOutlineBolt}
            tooltipLabel="Guide of how to add a Custom step for embedding in code"
            onClick={handleClick('custom')}
          />
        </WorkflowFloatingMenuSection>
      </menu>
      <DocsModal open={docsOpen} toggle={toggle} path={path} />
    </>
  );
};

interface IWorkflowFloatingMenuSectionProps extends PropsWithChildren<CoreProps> {
  title: LocalizedMessage;
}

function WorkflowFloatingMenuSection({ title, children }: IWorkflowFloatingMenuSectionProps) {
  return (
    <VStack gap="50">
      <Text variant="secondary" fontWeight="strong">
        {title}
      </Text>
      {children}
    </VStack>
  );
}

interface IWorkflowFloatingMenuButtonProps extends IconButtonProps {
  Icon: IconType;
  tooltipLabel?: LocalizedMessage;
}

function WorkflowFloatingMenuButton({ Icon, tooltipLabel, onClick }: IWorkflowFloatingMenuButtonProps) {
  return (
    <Tooltip label={tooltipLabel} position="left">
      <IconButton
        onClick={onClick}
        Icon={Icon}
        className={css({
          padding: '75 !important',
          borderRadius: '100',
          _hover: {
            // TODO: this doesn't work due to all the !important in novui... need to fix layer styles
            bg: 'legacy.B30 !important',
            '& svg': {
              color: 'typography.text.main !important',
            },
          },
        })}
      />
    </Tooltip>
  );
}
