import { Stack, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useGetUiConfig } from 'actions/uiConfig'
import Loading from 'src/common/Loading'
import MessageAlert from 'src/MessageAlert'
import TokenCommand from 'src/settings/authentication/TokenCommand'
import { TokenInterface } from 'types/types'

type DockerLoginProps = {
  token: TokenInterface
}

export default function DockerLogin({ token }: DockerLoginProps) {
  const { uiConfig, isUiConfigLoading, isUiConfigError } = useGetUiConfig()
  const theme = useTheme()

  if (isUiConfigError) {
    return <MessageAlert message={isUiConfigError.info.message} severity='error' />
  }

  return (
    <>
      {isUiConfigLoading && <Loading />}
      <Stack spacing={2} direction='column'>
        <Typography fontWeight='bold'>1. Run Docker login:</Typography>
        <Typography>Enter the following command on the command line: </Typography>
        {!token.secretKey && <Typography color={theme.palette.error.main}>Could not find Secret Key</Typography>}
        {token.secretKey && (
          <TokenCommand
            token={token}
            command={`docker login -u="<access-key>" -p="<secret-key>" ${uiConfig?.registry.host}`}
          />
        )}
      </Stack>
    </>
  )
}
