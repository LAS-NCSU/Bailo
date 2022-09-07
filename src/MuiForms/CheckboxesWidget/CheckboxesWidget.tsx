import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormGroup from '@mui/material/FormGroup'
import FormLabel from '@mui/material/FormLabel'
import { WidgetProps } from '@rjsf/core'
import React from 'react'

const selectValue = (value: any, selected: any, all: any) => {
  const at = all.indexOf(value)
  const updated = selected.slice(0, at).concat(value, selected.slice(at))

  // As inserting values at predefined index positions doesn't work with empty
  // arrays, we need to reorder the updated selection to match the initial order
  return updated.sort((a: any, b: any) => all.indexOf(a) > all.indexOf(b))
}

const deselectValue = (value: any, selected: any) => selected.filter((v: any) => v !== value)

function CheckboxesWidget({
  schema,
  label,
  id,
  disabled,
  options,
  value,
  autofocus,
  readonly,
  required,
  onChange,
  onBlur,
  onFocus,
}: WidgetProps) {
  const { enumOptions, enumDisabled, inline } = options

  const _onChange =
    (option: any) =>
    ({ target: { checked } }: React.ChangeEvent<HTMLInputElement>) => {
      const all = (enumOptions as any).map(({ value: newValue }: any) => newValue)

      if (checked) {
        onChange(selectValue(option.value, value, all))
      } else {
        onChange(deselectValue(option.value, value))
      }
    }

  const _onBlur = ({ target: { value: newValue } }: React.FocusEvent<HTMLButtonElement>) => onBlur(id, newValue)
  const _onFocus = ({ target: { value: newValue } }: React.FocusEvent<HTMLButtonElement>) => onFocus(id, newValue)

  return (
    <>
      <FormLabel required={required} htmlFor={id}>
        {label || schema.title}
      </FormLabel>
      <FormGroup row={!!inline}>
        {(enumOptions as any).map((option: any, index: number) => {
          const checked = value.indexOf(option.value) !== -1
          const itemDisabled = enumDisabled && (enumDisabled as any).indexOf(option.value) !== -1
          const checkbox = (
            <Checkbox
              id={`${id}_${index}`}
              checked={checked}
              disabled={disabled || itemDisabled || readonly}
              autoFocus={autofocus && index === 0}
              onChange={_onChange(option)}
              onBlur={_onBlur}
              onFocus={_onFocus}
            />
          )
          return <FormControlLabel control={checkbox} key={option.value} label={option.label} />
        })}
      </FormGroup>
    </>
  )
}

export default CheckboxesWidget
