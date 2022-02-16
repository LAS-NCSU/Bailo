import Paper from '@mui/material/Paper'
import React from 'react'
import Wrapper from '../src/Wrapper'
import { useGetUserDeployments } from '../data/deployment'
import { useGetModelById } from '../data/model'
import { useGetCurrentUser } from '../data/user'
import Box from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import { Deployment } from 'types/interfaces'
import _, { Dictionary } from 'lodash'
import Link from 'next/link'
import MuiLink from '@mui/material/Link'
import EmptyBlob from '../src/common/EmptyBlob'

const ModelNameFromKey = ({ modelId }: { modelId: string }) => {
  const { model, isModelLoading } = useGetModelById(modelId)
  if (isModelLoading) {
    return <Typography variant='h5'>Loading...</Typography>
  } else {
    return <Typography variant='h5'>{model?.currentMetadata?.highLevelDetails?.name}</Typography>
  }
}

const Deployments = () => {
  const { currentUser } = useGetCurrentUser()
  const { userDeployments, isUserDeploymentsLoading, isUserDeploymentsError } = useGetUserDeployments(currentUser?._id)

  const [selectedOrder, setSelectedOrder] = React.useState<string>('date')
  const [groupedDeployments, setGroupedDeployments] = React.useState<
    Dictionary<[Deployment, ...Deployment[]]> | undefined
  >(undefined)
  const [orderedDeployments, setOrderedDeployments] = React.useState<Deployment[] | undefined>([])

  React.useEffect(() => {
    if (!isUserDeploymentsLoading && !isUserDeploymentsError && userDeployments !== undefined) {
      const groups: Dictionary<[Deployment, ...Deployment[]]> = _.groupBy(
        userDeployments,
        (deployment) => deployment.model
      )
      setGroupedDeployments(groups)
      // Default the ordered deployment list to date
      let sortedArray: Deployment[] = [...userDeployments]
      sortedArray.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      setOrderedDeployments(sortedArray)
    }
  }, [userDeployments])

  const handleOrderChange = (event: any) => {
    setSelectedOrder(event.target.value)
  }

  const displayDate = (date: any) => {
    return new Date(date).toLocaleDateString('en-UK')
  }

  React.useEffect(() => {
    if (selectedOrder === 'name' && !isUserDeploymentsError && userDeployments !== undefined) {
      let sortedArray: Deployment[] = [...userDeployments].sort((a, b) =>
        a.metadata.highLevelDetails.name > b.metadata.highLevelDetails.name ? 1 : -1
      )
      setOrderedDeployments(sortedArray)
    } else if (selectedOrder === 'date' && userDeployments !== undefined) {
      let sortedArray: Deployment[] = [...userDeployments].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      setOrderedDeployments(sortedArray)
    }
  }, [selectedOrder])

  return (
    <>
      <Wrapper title='My Deployments' page={'deployments'}>
        <Box>
          <Paper sx={{ py: 2, px: 4 }}>
            <Box>
              <FormControl component='fieldset'>
                <FormLabel component='legend'>Organise by</FormLabel>
                <RadioGroup
                  defaultValue={'date'}
                  row
                  onChange={handleOrderChange}
                  aria-label='order'
                  name='row-radio-buttons-group'
                >
                  <FormControlLabel value='date' control={<Radio />} label='Date' />
                  <FormControlLabel value='name' control={<Radio />} label='Name' />
                  <FormControlLabel value='model' control={<Radio />} label='Model' />
                </RadioGroup>
              </FormControl>
            </Box>
            {(selectedOrder === 'date' || selectedOrder === 'name') && (
              <Box>
                {orderedDeployments !== undefined &&
                  orderedDeployments.map((deployment, index) => {
                    return (
                      <Box sx={{ p: 1, m: 1, backgroundColor: '#f3f1f1', borderRadius: 2 }} key={index}>
                        <Box>
                          <Link href={`/deployment/${deployment?.uuid}`} passHref>
                            <MuiLink variant='h5' sx={{ fontWeight: '500', textDecoration: 'none' }}>
                              {deployment?.metadata?.highLevelDetails?.name}
                            </MuiLink>
                          </Link>
                        </Box>
                        <Box>
                          <Typography variant='caption'>{displayDate(deployment?.createdAt)}</Typography>
                        </Box>
                      </Box>
                    )
                  })}
              </Box>
            )}
            {selectedOrder === 'model' && (
              <Box>
                {groupedDeployments !== undefined &&
                  Object.keys(groupedDeployments).map((key) => {
                    return (
                      <Box sx={{ mt: 3, mb: 3 }} key={key}>
                        <ModelNameFromKey modelId={key} />
                        <Divider flexItem />
                        {groupedDeployments[key].map((deployment, index) => {
                          return (
                            <Box sx={{ p: 1, m: 1, backgroundColor: '#f3f1f1', borderRadius: 2 }} key={index}>
                              <Box>
                                <Link href={`/deployment/${deployment?.uuid}`} passHref>
                                  <MuiLink variant='h5' sx={{ fontWeight: '500', textDecoration: 'none' }}>
                                    {deployment?.metadata?.highLevelDetails?.name}
                                  </MuiLink>
                                </Link>
                              </Box>
                              <Box>
                                <Typography variant='caption'>{displayDate(deployment?.createdAt)}</Typography>
                              </Box>
                            </Box>
                          )
                        })}
                      </Box>
                    )
                  })}
              </Box>
            )}
            <Box>
              {!isUserDeploymentsLoading && userDeployments!.length === 0 && <EmptyBlob text='No deployments here' />}
            </Box>
          </Paper>
        </Box>
      </Wrapper>
    </>
  )
}

export default Deployments
