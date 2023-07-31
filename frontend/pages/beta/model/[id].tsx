import { Box } from '@mui/material'
import { useRouter } from 'next/router'

import { useGetModel } from '../../../actions/model'
import EmptyBlob from '../../../src/common/EmptyBlob'
import PageWithTabs from '../../../src/common/PageWithTabs'
import Overview from '../../../src/model/beta/Overview'
import Releases from '../../../src/model/beta/Releases'
import Wrapper from '../../../src/Wrapper.beta'

export default function Model() {
  const router = useRouter()
  const { id }: { id?: string } = router.query
  const { model, isModelLoading, isModelError } = useGetModel(id)

  function myFunction() {
    console.log(model)
  }
  return (
    <Wrapper title='Model' page='marketplace' fullWidth>
      {isModelLoading && <Box sx={{ p: 4 }}>Loading model...</Box>}
      {!model && !isModelLoading && <EmptyBlob text={`Oh no, it looks like model ${id} doesn't exist!`} />}
      {model && !isModelLoading && !isModelError && (
        <PageWithTabs
          title={model.id}
          tabs={[
            { title: 'Overview', view: <Overview model={model} /> },
            { title: 'releases', view: <Releases model={model} /> },
          ]}
          actionButtonOnClick={myFunction}
          actionButtonTitle='Actions'
          displayActionButton
        />
      )}
    </Wrapper>
  )
}
