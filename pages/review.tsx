import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Grid from '@mui/material/Grid'
import MuiLink from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import Link from 'next/link'
import { useState } from 'react'
import Wrapper from 'src/Wrapper'
import { postEndpoint } from '../data/api'
import { RequestType, ReviewFilterType, useGetNumRequests, useListRequests } from '../data/requests'
import EmptyBlob from '../src/common/EmptyBlob'
import MultipleErrorWrapper from '../src/errors/MultipleErrorWrapper'
import { Request } from '../types/interfaces'

export default function Review() {
  const [value, setValue] = useState<ReviewFilterType>('user')

  const handleChange = (_event: React.SyntheticEvent, newValue: ReviewFilterType) => {
    setValue(newValue)
  }

  return (
    <Wrapper title='Reviews' page='review'>
      <Tabs value={value} onChange={handleChange}>
        <Tab value='user' label='Approvals' />
        <Tab value='archived' label='Archived' />
      </Tabs>

      <ApprovalList type='Upload' category={value} />
      <ApprovalList type='Deployment' category={value} />
    </Wrapper>
  )
}

function ErrorWrapper({ message }: { message: string | undefined }) {
  return (
    <Paper sx={{ mt: 2, mb: 2 }}>
      <Alert severity='error'>{message || 'Unable to communicate with server.'}</Alert>
    </Paper>
  )
}

function ApprovalList({ type, category }: { type: RequestType; category: ReviewFilterType }) {
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState('')
  const [request, setRequest] = useState<Request | undefined>(undefined)
  const [approvalModalText, setApprovalModalText] = useState('')
  const [approvalModalTitle, setApprovalModalTitle] = useState('')

  const theme = useTheme()

  const { requests, isRequestsLoading, isRequestsError, mutateRequests } = useListRequests(type, category)
  const { mutateNumRequests } = useGetNumRequests()

  const managerStyling = {
    mb: 2,
    borderLeft: '.3rem solid #283593',
    p: 2,
    backgroundColor: theme.palette.container.main,
  }
  const reviewerStyling = {
    mb: 2,
    borderLeft: '.3rem solid #de3c30',
    p: 2,
    backgroundColor: theme.palette.container.main,
  }

  const handleClose = () => {
    setOpen(false)
  }

  const onCancel = () => {
    setOpen(false)
  }

  const onConfirm = async () => {
    await postEndpoint(`/api/v1/request/${request?._id}/respond`, { choice }).then((res) => res.json())

    mutateRequests()
    mutateNumRequests()
    setOpen(false)
  }

  const error = MultipleErrorWrapper(
    `Unable to load approval page`,
    {
      isRequestsError,
    },
    ErrorWrapper
  )
  if (error) return error

  const changeState = (changeStateChoice: string, changeStateRequest: Request) => {
    setOpen(true)
    setRequest(changeStateRequest)
    setChoice(changeStateChoice)
    if (changeStateChoice === 'Accepted') {
      setApprovalModalTitle(`Approve ${type}`)
      setApprovalModalText(`I can confirm that the ${type.toLowerCase()} meets all necessary requirements.`)
    } else {
      setApprovalModalTitle(`Reject ${type}`)
      setApprovalModalText(`The ${type.toLowerCase()} does not meet the necessary requirements for approval.`)
    }
  }

  const getUploadType = (requestType: string) => (requestType === 'Upload' ? 'models' : 'deployments')

  if (isRequestsLoading || !requests) {
    return <Paper sx={{ mt: 2, mb: 2 }} />
  }

  return (
    <Paper sx={{ mt: 2, mb: 2, pb: 2 }}>
      <Typography sx={{ p: 3 }} variant='h4'>
        {type === 'Upload' ? 'Models' : 'Deployments'}
      </Typography>
      {requests.map((requestObj: any) => (
        <Box sx={{ px: 3 }} key={requestObj._id}>
          <Grid container spacing={1} sx={requestObj.approvalType === 'Manager' ? managerStyling : reviewerStyling}>
            <Grid item xs={12} md={9}>
              {type === 'Upload' && (
                <>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={{ xs: 0, sm: 2 }}
                    alignItems={{ xs: 'left', sm: 'center' }}
                    justifyContent='flex-start'
                    sx={{
                      [theme.breakpoints.down('sm')]: {
                        mb: 1,
                      },
                    }}
                  >
                    <Link href={`/model/${requestObj.version?.model?.uuid}`} passHref>
                      <MuiLink
                        variant='h5'
                        sx={{ fontWeight: '500', textDecoration: 'none', color: theme.palette.secondary.main }}
                      >
                        {requestObj.version?.metadata?.highLevelDetails?.name}
                      </MuiLink>
                    </Link>
                    <div>Version: {requestObj.version?.version}</div>
                  </Stack>
                  <Stack direction='row' spacing={2}>
                    <Chip color='primary' label={requestObj.approvalType} size='small' />
                    <Box sx={{ mt: 'auto !important', mb: 'auto !important' }}>
                      <Typography variant='body1'>
                        {requestObj.version?.metadata?.highLevelDetails?.modelInASentence}
                      </Typography>
                    </Box>
                  </Stack>
                  {requestObj.version === undefined ||
                    (requestObj.version === null && (
                      <Alert sx={{ mt: 2 }} severity='warning'>
                        This model appears to have data missing - check with the uploader to make sure it was uploaded
                        correctly
                      </Alert>
                    ))}
                </>
              )}
              {type === 'Deployment' && (
                <>
                  <Link href={`/deployment/${requestObj.deployment?.uuid}`} passHref>
                    <MuiLink
                      variant='h5'
                      sx={{ fontWeight: '500', textDecoration: 'none', color: theme.palette.secondary.main }}
                    >
                      {requestObj.deployment?.metadata?.highLevelDetails?.name}
                    </MuiLink>
                  </Link>
                  <Typography variant='body1'>
                    Requesting deployment of{' '}
                    <Link href={`/model/${requestObj.deployment?.model?.uuid}`} passHref>
                      <MuiLink sx={{ fontWeight: '500', textDecoration: 'none', color: theme.palette.secondary.main }}>
                        {requestObj.deployment?.model?.currentMetadata?.highLevelDetails?.name}
                      </MuiLink>
                    </Link>
                  </Typography>
                  {requestObj.deployment === undefined ||
                    (requestObj.deployment === null && (
                      <Alert sx={{ mt: 2 }} severity='warning'>
                        This deployment appears to have data missing - check with the requester to make sure it was
                        requested correctly
                      </Alert>
                    ))}
                </>
              )}
            </Grid>
            <Grid item xs={12} md sx={{ display: 'flex' }}>
              <Box ml='auto' my='auto'>
                {requestObj.status !== 'No Response' && (
                  <Chip label={requestObj.status} color={requestObj.status === 'Accepted' ? 'success' : 'error'} />
                )}
              </Box>
            </Grid>
            <Grid item sx={{ display: 'flex', width: 200 }}>
              <Box ml='auto' my='auto'>
                <Button
                  color='secondary'
                  variant='outlined'
                  onClick={() => changeState('Declined', requestObj)}
                  sx={{ mr: 1 }}
                  disabled={requestObj.status === 'Declined'}
                >
                  Reject
                </Button>
                <Button
                  variant='contained'
                  onClick={() => changeState('Accepted', requestObj)}
                  data-test='approveButton'
                  disabled={requestObj.status === 'Accepted'}
                >
                  Approve
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      ))}
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle id='alert-dialog-title'>{approvalModalTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText id='alert-dialog-description'>{approvalModalText}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color='secondary' variant='outlined' onClick={onCancel}>
            Cancel
          </Button>
          <Button variant='contained' onClick={onConfirm} autoFocus data-test='confirmButton'>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
      {requests.length === 0 && <EmptyBlob text={`All done! No ${getUploadType(type)} are waiting for approvals`} />}
    </Paper>
  )
}
