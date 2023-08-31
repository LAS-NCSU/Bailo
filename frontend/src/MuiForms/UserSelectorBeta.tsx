import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Autocomplete, CircularProgress, TextField } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import * as React from 'react'

import { useListUsers } from '../../data/user'

export default function UserSelector(props: any) {
  const { users, isUsersLoading } = useListUsers()
  const [open, setOpen] = React.useState(false)

  const { onChange, value: currentValue, label, formContext } = props

  const _onChange = (_event: any, newValue: any) => {
    onChange(newValue?.id)
  }

  const theme = useTheme()

  return (
    <Autocomplete
      open={open}
      onOpen={() => {
        setOpen(true)
      }}
      onClose={() => {
        setOpen(false)
      }}
      // we might get a string or an object back
      isOptionEqualToValue={(option: any, value: any) => option.id === value.id || option.id === value}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.id)}
      value={currentValue || null}
      onChange={_onChange}
      options={users || []}
      loading={isUsersLoading}
      disabled={!formContext.editMode}
      popupIcon={!formContext.editMode ? <></> : <ExpandMoreIcon />}
      renderInput={(params) => (
        <TextField
          {...params}
          size='small'
          sx={{
            input: {
              color: theme.palette.mode === 'light' ? 'black' : 'white',
            },
            label: {
              WebkitTextFillColor: theme.palette.mode === 'light' ? 'black' : 'white',
            },
            '& .MuiInputBase-input.Mui-disabled': {
              WebkitTextFillColor: theme.palette.mode === 'light' ? 'black' : 'white',
            },
          }}
          variant={!formContext.editMode ? 'standard' : 'outlined'}
          label={label}
          required={!formContext.editMode ? false : true}
          InputProps={{
            ...params.InputProps,
            disableUnderline: !formContext.editMode ? true : false,
            endAdornment: (
              <>
                {isUsersLoading ? <CircularProgress color='inherit' size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  )
}