import type { ButtonHTMLAttributes } from 'react';
import './controls.css';

export function Button({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={['ctl-button', className].filter(Boolean).join(' ')} {...rest} />;
}
