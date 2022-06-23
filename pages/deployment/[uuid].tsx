import Info from '@mui/icons-material/Info'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import DialogActions from '@mui/material/DialogActions'
import Paper from '@mui/material/Paper'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Tooltip from '@mui/material/Tooltip'
import Box from '@mui/system/Box'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import React, { MouseEvent, useEffect, useState } from 'react'
import { Elements } from 'react-flow-renderer'
import Menu from '@mui/material/Menu'
import MenuList from '@mui/material/MenuList'
import ListItemText from '@mui/material/ListItemText'
import ListItemIcon from '@mui/material/ListItemIcon'
import DownArrow from '@mui/icons-material/KeyboardArrowDown'
import UpArrow from '@mui/icons-material/KeyboardArrowUp'
import Stack from '@mui/material/Stack'
import RestartAlt from '@mui/icons-material/RestartAlt'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'

import Link from 'next/link'
import { useGetDeployment } from '../../data/deployment'
import { useGetUiConfig } from '../../data/uiConfig'
import { useGetCurrentUser } from '../../data/user'
import CopiedSnackbar from '../../src/common/CopiedSnackbar'
import DeploymentOverview from '../../src/DeploymentOverview'
import MultipleErrorWrapper from '../../src/errors/MultipleErrorWrapper'
import TerminalLog from '../../src/TerminalLog'
import Wrapper from '../../src/Wrapper'
import { createDeploymentComplianceFlow } from '../../utils/complianceFlow'
import ApprovalsChip from '../../src/common/ApprovalsChip'
import { postEndpoint } from '../../data/api'

const ComplianceFlow = dynamic(() => import('../../src/ComplianceFlow'))

type TabOptions = 'overview' | 'compliance' | 'build' | 'settings'

function CodeLine({ line }) {
  const [openSnackbar, setOpenSnackbar] = useState(false)

  const handleButtonClick = () => {
    navigator.clipboard.writeText(line)
    setOpenSnackbar(true)
  }

  return (
    <>
      <div
        style={{
          cursor: 'pointer',
        }}
        role='button'
        tabIndex={0}
        onClick={() => {
          handleButtonClick()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleButtonClick()
          }
        }}
      >
        ${' '}
        <Tooltip title='Copy to clipboard' arrow>
          <b
            style={{
              background: '#e0e0e0',
            }}
          >
            {line}
          </b>
        </Tooltip>
      </div>
      <CopiedSnackbar {...{ openSnackbar, setOpenSnackbar }} />
    </>
  )
}

export default function Deployment() {
  const router = useRouter()
  const { uuid }: { uuid?: string } = router.query

  const [tab, setTab] = useState<TabOptions>('overview')
  const [complianceFlow, setComplianceFlow] = useState<Elements>([])
  const [open, setOpen] = useState<boolean>(false)
  const [tag, setTag] = useState<string>('')
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null)
  const actionOpen = anchorEl !== null
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleToggleConfirmDialog = () => {
    setConfirmOpen(!confirmOpen)
  }

  const onCancelDelete = () => {
    handleToggleConfirmDialog()
  }

  const { currentUser, isCurrentUserLoading, isCurrentUserError } = useGetCurrentUser()
  const { deployment, isDeploymentLoading, isDeploymentError } = useGetDeployment(uuid)
  const { uiConfig, isUiConfigLoading, isUiConfigError } = useGetUiConfig()

  useEffect(() => {
    if (deployment?.metadata?.highLevelDetails !== undefined) {
      const { modelID, initialVersionRequested } = deployment.metadata.highLevelDetails
      setTag(`${modelID}:${initialVersionRequested}`)
    }
  }, [deployment])

  const handleTabChange = (_event: React.SyntheticEvent, newValue: TabOptions) => {
    setTab(newValue)
  }

  useEffect(() => {
    if (deployment) {
      setComplianceFlow(createDeploymentComplianceFlow(deployment))
    }
  }, [deployment])

  const handleClickOpen = () => {
    if (!isDeploymentLoading && deployment !== undefined) {
      setOpen(true)
    }
  }

  const handleClose = () => {
    setOpen(false)
  }

  const actionMenuClicked = (event: MouseEvent) => {
    setAnchorEl(event.currentTarget as HTMLDivElement)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const error = MultipleErrorWrapper(`Unable to load deployment page`, {
    isDeploymentError,
    isUiConfigError,
    isCurrentUserError,
  })
  if (error) return error

  const Loading = <Wrapper title='Loading...' page='deployment' />

  if (isDeploymentLoading || !deployment) return Loading
  if (isUiConfigLoading || !uiConfig) return Loading
  if (isCurrentUserLoading || !currentUser) return Loading

  const deploymentTag = `${uiConfig?.registry.host}/${currentUser.id}/${tag}`

  const requestApprovalReset = async () => {
    await postEndpoint(`/api/v1/deployment/${deployment?.uuid}/reset-approvals`, {}).then((res) => res.json())
  }

  const requestDeploymentDelete = async () => {
    await postEndpoint(`/api/v1/deployment/retire`, { uuids: [deployment?.uuid] }).then(() => router.reload())
  }
  return (
    <>
      <Wrapper title={`Deployment: ${deployment.metadata.highLevelDetails.name}`} page='deployment'>
        <Box sx={{ textAlign: 'right', pb: 3 }}>
          {!deployment.deleted && (
            <Button variant='outlined' color='primary' startIcon={<Info />} onClick={handleClickOpen}>
              Show download commands
            </Button>
          )}
        </Box>
        <Paper sx={{ p: 3 }}>
          <Stack direction='row' spacing={2}>
            <ApprovalsChip approvals={[deployment?.managerApproved]} />
            <Divider orientation='vertical' flexItem />
            <Button
              id='model-actions-button'
              aria-controls='model-actions-menu'
              aria-haspopup='true'
              aria-expanded={actionOpen ? 'true' : undefined}
              onClick={actionMenuClicked}
              variant='outlined'
              data-test='requestDeploymentButton'
              endIcon={actionOpen ? <UpArrow /> : <DownArrow />}
            >
              Actions
            </Button>
            {deployment.deleted && (
              <Typography
                variant='body1'
                sx={{ marginBottom: 2, textAlign: 'right', marginRight: 2, color: 'error.main', alignSelf: 'center' }}
              >
                Deployment Deleted
              </Typography>
            )}
          </Stack>
          <Menu anchorEl={anchorEl as HTMLDivElement} open={actionOpen} onClose={handleMenuClose}>
            <MenuList>
              <MenuItem onClick={requestApprovalReset} disabled={deployment?.managerApproved === 'No Response'}>
                <ListItemIcon>
                  <RestartAlt fontSize='small' />
                </ListItemIcon>
                <ListItemText>Reset approvals</ListItemText>
              </MenuItem>
            </MenuList>
          </Menu>
          <Box sx={{ borderBottom: 1, marginTop: 1, borderColor: 'divider' }}>
            <Tabs indicatorColor='secondary' value={tab} onChange={handleTabChange} aria-label='basic tabs example'>
              <Tab label='Overview' value='overview' />
              <Tab label='Compliance' value='compliance' />
              <Tab label='Build Logs' value='build' />
              <Tab label='Settings' value='settings' />
            </Tabs>
          </Box>
          <Box sx={{ marginBottom: 3 }} />

          {tab === 'overview' && <DeploymentOverview version={deployment} use='DEPLOYMENT' />}

          {tab === 'compliance' && <ComplianceFlow initialElements={complianceFlow} />}

          {tab === 'build' && <TerminalLog logs={deployment.logs} title='Deployment Build Logs' />}

          {tab === 'settings' && (
            <>
              <Typography variant='h6' sx={{ mb: 1 }}>
                General
              </Typography>

              <Box sx={{ mb: 4 }} />

              <Typography variant='h6' sx={{ mb: 1 }}>
                Danger Zone
              </Typography>
              <Button variant='contained' color='error' onClick={handleToggleConfirmDialog}>
                Delete Deployment
              </Button>
              <Dialog open={confirmOpen} onClose={handleToggleConfirmDialog}>
                <DialogTitle id='alert-dialog-title'>Confirm Delete Deployment</DialogTitle>
                <DialogContent>
                  <DialogContentText id='alert-dialog-description'>
                    Are you sure you want to delete this deployment
                  </DialogContentText>
                </DialogContent>
                <DialogActions>
                  <Button color='secondary' variant='outlined' onClick={onCancelDelete}>
                    Cancel
                  </Button>
                  <Button variant='contained' onClick={requestDeploymentDelete} data-test='confirmButton' color='error'>
                    Confirm
                  </Button>
                </DialogActions>
              </Dialog>
            </>
          )}
        </Paper>
      </Wrapper>
      <Dialog maxWidth='lg' onClose={handleClose} open={open}>
        <DialogTitle>Pull from Docker</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ backgroundColor: 'whitesmoke', p: 2 }}>
            <Box>
              <p>
                # Login to Docker (your token can be found on the <Link href='/settings'>settings</Link> page)
              </p>
              <CodeLine line={`docker login ${uiConfig.registry.host} -u ${currentUser.id}`} />
              <br />

              <p># Pull model</p>
              <CodeLine line={`docker pull ${deploymentTag}`} />
              <br />

              <p># Run Docker image</p>
              <CodeLine line={`docker run -p 9999:9000 ${deploymentTag}`} />
              <p># (the container exposes on port 9000, available on the host as port 9999)</p>
              <br />

              <p># Check that the Docker container is running</p>
              <CodeLine line='docker ps' />
              <br />

              <p># The model is accessible at localhost:9999</p>
            </Box>
          </DialogContentText>
        </DialogContent>
      </Dialog>
    </>
  )
}
