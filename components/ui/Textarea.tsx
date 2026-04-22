'use client'

import { useId } from 'react'

export interface TextareaProps {
  label?:       string
  value:        string
  onChange:     (val: string) => void
  placeholder?: string
  rows?:        number
  disabled?:    boolean
  required?:    boolean
  spellCheck?:  boolean
  error?:       string
  helper?:      string
}

export function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows       = 4,
  disabled,
  required,
  spellCheck,
  error,
  helper,
}: TextareaProps) {
  const id      = useId()
  const errorId = `${id}-error`
  const helpId  = `${id}-help`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label htmlFor={id} style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-gray-600)' }}>
          {label}
          {required && <span style={{ color: 'var(--color-danger)' }} aria-hidden="true"> *</span>}
        </label>
      )}
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        required={required}
        spellCheck={spellCheck}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : helper ? helpId : undefined}
        style={{
          border:          `1.5px solid ${error ? 'var(--color-danger)' : 'var(--color-gray-200)'}`,
          borderRadius:    'var(--radius-sm)',
          padding:         '10px 14px',
          fontSize:        14,
          color:           'var(--color-gray-900)',
          backgroundColor: disabled ? 'var(--color-gray-50)' : 'var(--color-card-bg)',
          outline:         'none',
          width:           '100%',
          boxSizing:       'border-box',
          resize:          'vertical',
          fontFamily:      'inherit',
          transition:      'border-color 0.15s',
        }}
        onFocus={(e) => { if (!error) e.target.style.borderColor = 'var(--color-primary)' }}
        onBlur={(e)  => { if (!error) e.target.style.borderColor = 'var(--color-gray-200)' }}
      />
      {error  && <span id={errorId} role="alert" style={{ fontSize: 12, color: 'var(--color-danger)' }}>{error}</span>}
      {helper && !error && <span id={helpId} style={{ fontSize: 12, color: 'var(--color-gray-400)' }}>{helper}</span>}
    </div>
  )
}

export default Textarea
