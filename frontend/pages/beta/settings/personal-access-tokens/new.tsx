import { ArrowBack } from '@mui/icons-material'
import { LoadingButton } from '@mui/lab'
import {
  Autocomplete,
  Button,
  Card,
  Checkbox,
  Container,
  FormControl,
  FormControlLabel,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { ModelSearchResult, useListModels } from 'actions/model'
import { postUserToken } from 'actions/user'
import { ChangeEvent, SyntheticEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'src/Link'
import MessageAlert from 'src/MessageAlert'
import TokenDialog from 'src/settings/beta/authentication/TokenDialog'
import Wrapper from 'src/Wrapper.beta'
import { TokenActions, TokenActionsKeys, TokenInterface, TokenScope } from 'types/v2/types'
import { getErrorMessage } from 'utils/fetcher'

export default function NewToken() {
  const theme = useTheme()
  const [description, setDescription] = useState('')
  const [isAllModels, setIsAllModels] = useState(false)
  const [selectedModels, setSelectedModels] = useState<ModelSearchResult[]>([])
  const [selectedActions, setSelectedActions] = useState<TokenActionsKeys[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [token, setToken] = useState<TokenInterface | undefined>()

  const { models, isModelsLoading, isModelsError } = useListModels([])

  useEffect(() => {
    const areAllModelsSelected = selectedModels.length === models.length
    if (!isAllModels && areAllModelsSelected) {
      setIsAllModels(true)
    } else if (isAllModels && !areAllModelsSelected) {
      setIsAllModels(false)
    }
  }, [isAllModels, models.length, selectedModels.length])

  const handleSelectedActionsChange = useCallback(
    (action: TokenActionsKeys, checked: boolean) => {
      if (checked) {
        setSelectedActions([...selectedActions, action])
      } else {
        const foundIndex = selectedActions.findIndex((selectedRepository) => selectedRepository === action)
        if (foundIndex >= 0) {
          const updatedSelectedActions = [...selectedActions]
          updatedSelectedActions.splice(foundIndex, 1)
          setSelectedActions(updatedSelectedActions)
        }
      }
    },
    [selectedActions],
  )

  const actionCheckboxes = useMemo(
    () =>
      Object.values(TokenActions).map((action) => (
        <Grid item xs={6} key={action}>
          <FormControl>
            <FormControlLabel
              control={
                <Checkbox
                  name={action}
                  checked={selectedActions.includes(action)}
                  onChange={(_event, checked) => handleSelectedActionsChange(action, checked)}
                />
              }
              label={action}
            />
          </FormControl>
        </Grid>
      )),
    [handleSelectedActionsChange, selectedActions],
  )

  const handleDescriptionChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(event.target.value)
  }

  const handleAllSelectedModelsChange = (_event: ChangeEvent<HTMLInputElement>, checked: boolean) => {
    setIsAllModels(checked)
    setSelectedModels(checked ? models : [])
  }

  const handleSelectedModelsChange = (_: SyntheticEvent<Element, Event>, value: ModelSearchResult[]) => {
    setSelectedModels(value)
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    const scope = isAllModels ? TokenScope.All : TokenScope.Models
    const modelIds = isAllModels ? [] : selectedModels.map((model) => model.id)
    const response = await postUserToken(description, scope, modelIds, selectedActions)

    if (!response.ok) {
      setErrorMessage(await getErrorMessage(response))
    } else {
      const { token } = await response.json()
      setToken(token)
    }

    setIsLoading(false)
  }

  return (
    <Wrapper title='Personal Access Token' page='Token'>
      <Container maxWidth='md'>
        <Card sx={{ my: 4, p: 4 }}>
          <Stack spacing={2}>
            <Link href={'/beta/settings?tab=authentication&category=personal'}>
              <Button startIcon={<ArrowBack />}>Back to settings</Button>
            </Link>
            <Stack spacing={2}>
              <Stack>
                <Typography fontWeight='bold'>
                  Description <span style={{ color: theme.palette.error.main }}>*</span>
                </Typography>
                <TextField
                  required
                  multiline
                  size='small'
                  value={description}
                  maxRows={8}
                  onChange={handleDescriptionChange}
                  inputProps={{ 'data-test': 'tokenDescriptionTextField' }}
                />
              </Stack>
              <Stack>
                <Typography fontWeight='bold'>
                  Models <span style={{ color: theme.palette.error.main }}>*</span>
                </Typography>
                <FormControl>
                  <FormControlLabel
                    control={
                      <Checkbox
                        name='All'
                        checked={isAllModels}
                        disabled={isModelsLoading}
                        onChange={handleAllSelectedModelsChange}
                      />
                    }
                    label='All'
                  />
                </FormControl>
                <Autocomplete
                  multiple
                  value={selectedModels}
                  loading={isModelsLoading}
                  options={models}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => <TextField {...params} required size='small' />}
                  onChange={handleSelectedModelsChange}
                />
              </Stack>
              <Stack>
                <Typography fontWeight='bold'>
                  Actions <span style={{ color: theme.palette.error.main }}>*</span>
                </Typography>
                <Grid container>{actionCheckboxes}</Grid>
              </Stack>
              <Stack alignItems='flex-end'>
                <LoadingButton
                  variant='contained'
                  loading={isLoading}
                  disabled={!description || !selectedModels.length || !selectedActions.length}
                  onClick={handleSubmit}
                  data-test='generatePersonalAccessTokenButton'
                >
                  Generate Token
                </LoadingButton>
                <MessageAlert message={isModelsError?.info.message || errorMessage} severity='error' />
              </Stack>
            </Stack>
          </Stack>
        </Card>
      </Container>
      <TokenDialog token={token} />
    </Wrapper>
  )
}
