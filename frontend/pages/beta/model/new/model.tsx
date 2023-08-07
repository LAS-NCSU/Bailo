import { Lock, LockOpen } from '@mui/icons-material'
import {
  Box,
  Button,
  Card,
  Divider,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useRouter } from 'next/router'
import { useState } from 'react'

import { postModel } from '../../../../actions/model'
import TeamAndModelSelector from '../../../../src/common/TeamAndModelSelector'
import MessageAlert from '../../../../src/MessageAlert'
import Wrapper from '../../../../src/Wrapper.beta'
import { ModelForm } from '../../../../types/types'

export default function NewModel() {
  const [teamName, setTeamName] = useState('')
  const [modelName, setModelName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<ModelForm['visibility']>('public')
  const [errorMessage, setErrorMessage] = useState('')

  const router = useRouter()
  const theme = useTheme()

  const formValid = teamName && modelName && description

  async function onSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    const formData: ModelForm = {
      name: `${teamName}/${modelName}`,
      description,
      visibility,
    }
    const response = await postModel(formData)
    if (response.status === 200) {
      router.push(`/beta/model/${response.data.model.id}`)
    } else {
      setErrorMessage(response.data)
    }
  }

  const privateLabel = () => {
    return (
      <Stack direction='row' justifyContent='center' alignItems='center' spacing={1}>
        <Lock />
        <Stack sx={{ my: 1 }}>
          <Typography sx={{ fontWeight: 'bold' }}>Private</Typography>
          <Typography variant='caption'>You choose who can access this model</Typography>
        </Stack>
      </Stack>
    )
  }

  const publicLabel = () => {
    return (
      <Stack direction='row' justifyContent='center' alignItems='center' spacing={1}>
        <LockOpen />
        <Stack sx={{ my: 1 }}>
          <Typography sx={{ fontWeight: 'bold' }}>Public</Typography>
          <Typography variant='caption'>You choose who can access this model</Typography>
        </Stack>
      </Stack>
    )
  }

  return (
    <Wrapper title='Create a new Model' page='upload'>
      <Card sx={{ p: 4, maxWidth: 500, m: 'auto' }}>
        <Typography component='h2' variant='h4' sx={{ fontWeight: 'bold' }} color='primary'>
          Create a new model
        </Typography>
        <Typography>A model repository contains all files, history and information related to a model.</Typography>
        <Box component='form' sx={{ mt: 4 }} onSubmit={onSubmit}>
          <Stack divider={<Divider orientation='vertical' flexItem />} spacing={2}>
            <>
              <Typography component='h3' variant='h6'>
                Overview
              </Typography>
              <Stack direction='row' spacing={2}>
                <TeamAndModelSelector
                  setTeamValue={setTeamName}
                  teamValue={teamName}
                  setModelValue={setModelName}
                  modelValue={modelName}
                />
              </Stack>
              <Stack>
                <FormControl>
                  <Typography component='label' sx={{ fontWeight: 'bold' }} htmlFor={'new-model-description'}>
                    Description <span style={{ color: theme.palette.primary.main }}>*</span>
                  </Typography>
                  <TextField
                    id='new-model-description'
                    required
                    size='small'
                    value={description}
                    tabIndex={0}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </FormControl>
              </Stack>
            </>
            <Divider />
            <>
              <Typography component='h3' variant='h6'>
                Access control
              </Typography>
              <RadioGroup
                defaultValue='public'
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as ModelForm['visibility'])}
              >
                <FormControlLabel value='public' control={<Radio />} label={publicLabel()} />
                <FormControlLabel value='private' control={<Radio />} label={privateLabel()} />
              </RadioGroup>
            </>
            <Divider />
            <Box sx={{ textAlign: 'right' }}>
              <Tooltip title={!formValid ? 'Please make sure all required fields are filled out' : ''}>
                <span>
                  <Button tabIndex={0} variant='contained' disabled={!formValid} type='submit'>
                    Create Model
                  </Button>
                </span>
              </Tooltip>
              <MessageAlert message={errorMessage} severity='error' />
            </Box>
          </Stack>
        </Box>
      </Card>
    </Wrapper>
  )
}
