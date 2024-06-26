import { Box, Button, Container, Stack } from '@mui/material'
import { useGetModelImages } from 'actions/model'
import { useMemo, useState } from 'react'
import EmptyBlob from 'src/common/EmptyBlob'
import Forbidden from 'src/common/Forbidden'
import Loading from 'src/common/Loading'
import ModelImageDisplay from 'src/entry/model/registry/ModelImageDisplay'
import UploadModelImageDialog from 'src/entry/model/registry/UploadModelImageDialog'
import MessageAlert from 'src/MessageAlert'
import { EntryInterface } from 'types/types'

type AccessRequestsProps = {
  model: EntryInterface
}

export default function ModelImages({ model }: AccessRequestsProps) {
  const { modelImages, isModelImagesLoading, isModelImagesError } = useGetModelImages(model.id)

  const [openUploadImageDialog, setOpenUploadImageDialog] = useState(false)

  const modelImageList = useMemo(
    () =>
      modelImages.length ? (
        modelImages.map((modelImage) => (
          <ModelImageDisplay modelImage={modelImage} key={`${modelImage.repository}-${modelImage.name}`} />
        ))
      ) : (
        <EmptyBlob text={`No images found for model ${model.name}`} />
      ),
    [modelImages, model.name],
  )

  if (isModelImagesError) {
    if (isModelImagesError.status === 403) {
      return (
        <Forbidden
          errorMessage='If you think this is in error please contact the model owners.'
          noMargin
          hideNavButton
        />
      )
    } else {
      return <MessageAlert message={isModelImagesError.info.message} severity='error' />
    }
  }

  return (
    <>
      {isModelImagesLoading && <Loading />}
      <Container sx={{ my: 2 }}>
        <Stack spacing={4}>
          <Box sx={{ textAlign: 'right' }}>
            <Button variant='outlined' onClick={() => setOpenUploadImageDialog(true)} data-test='pushImageButton'>
              Push image
            </Button>
            <UploadModelImageDialog
              open={openUploadImageDialog}
              handleClose={() => setOpenUploadImageDialog(false)}
              model={model}
            />
          </Box>
          {modelImageList}
        </Stack>
      </Container>
    </>
  )
}
