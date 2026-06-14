import { useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  inputClassName?: string;
};

export function PasswordInput({ inputClassName, className, ...props }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${className ?? ''}`}>
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`${inputClassName ?? ''} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-dark-400 transition-colors hover:bg-dark-100 hover:text-dark-700"
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        <i className={`fa-solid ${visible ? 'fa-eye-slash' : 'fa-eye'} text-sm`} aria-hidden />
      </button>
    </div>
  );
}
