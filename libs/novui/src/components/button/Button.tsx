import {
  Button as ExternalButton,
  ButtonProps as ExternalButtonProps,
  ButtonVariant as ExternalButtonVariant,
} from '@mantine/core';
import React from 'react';
import { css, cx } from '../../../styled-system/css';
import { splitCssProps } from '../../../styled-system/jsx';
import { button, type ButtonVariant } from '../../../styled-system/recipes';
import { JsxStyleProps } from '../../../styled-system/types';
import { IconType } from '../../icons';
import { CoreProps, CorePropsWithChildren } from '../../types';
import { PolymorphicComponentPropWithRef, PolymorphicRef } from '../../types/props-helpers';

export interface ButtonCoreProps
  extends CorePropsWithChildren,
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    Pick<ExternalButtonProps, 'size' | 'loading'> {
  Icon?: IconType;
  loading?: boolean;
}

type IconButtonDefaultElement = 'button';

export type ButtonProps<C extends React.ElementType = IconButtonDefaultElement> = PolymorphicComponentPropWithRef<
  C,
  JsxStyleProps & Partial<ButtonVariant> & CoreProps & ButtonCoreProps
>;

const DEFAULT_VARIANT: ButtonVariant['variant'] = 'filled';

type PolymorphicComponent = <C extends React.ElementType = IconButtonDefaultElement>(
  props: ButtonProps<C>
) => JSX.Element | null;

export const Button: PolymorphicComponent = React.forwardRef(
  <C extends React.ElementType = IconButtonDefaultElement>(
    { variant = DEFAULT_VARIANT, ...props }: ButtonProps<C>,
    ref?: PolymorphicRef<C>
  ) => {
    const [variantProps, buttonProps] = button.splitVariantProps({ ...props, variant });
    const [cssProps, localProps] = splitCssProps(buttonProps);
    const { className, as, Icon, size, children, ...otherProps } = localProps;
    const styles = button(variantProps);

    return (
      <ExternalButton
        ref={ref}
        component={as ?? 'button'}
        size={size}
        leftSection={Icon ? <Icon title="button-icon" size={variant === 'transparent' ? '20' : '16'} /> : undefined}
        classNames={styles}
        className={cx(css(cssProps), className)}
        variant={
          ['outline', 'filled'].includes(variant as ExternalButtonVariant)
            ? (variant as ExternalButtonVariant)
            : undefined
        }
        {...otherProps}
      >
        {children}
      </ExternalButton>
    );
  }
);
