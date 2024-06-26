import { ArrowBack, DesignServices } from '@mui/icons-material'
import { LoadingButton } from '@mui/lab'
import { Box, Button, Card, Container, Stack, Typography } from '@mui/material'
import { useGetModel } from 'actions/model'
import { CreateReleaseParams, postRelease, postSimpleFileForRelease } from 'actions/release'
import { AxiosProgressEvent } from 'axios'
import { useRouter } from 'next/router'
import { FormEvent, useCallback, useState } from 'react'
import Loading from 'src/common/Loading'
import Title from 'src/common/Title'
import ReleaseForm from 'src/entry/model/releases/ReleaseForm'
import MultipleErrorWrapper from 'src/errors/MultipleErrorWrapper'
import useNotification from 'src/hooks/useNotification'
import Link from 'src/Link'
import MessageAlert from 'src/MessageAlert'
import {
  EntryKind,
  FileInterface,
  FileUploadProgress,
  FileWithMetadata,
  FlattenedModelImage,
  isFileInterface,
} from 'types/types'
import { getErrorMessage } from 'utils/fetcher'
import { isValidSemver } from 'utils/stringUtils'

export default function NewRelease() {
  const [semver, setSemver] = useState('')
  const [releaseNotes, setReleaseNotes] = useState('')
  const [isMinorRelease, setIsMinorRelease] = useState(false)
  const [files, setFiles] = useState<(File | FileInterface)[]>([])
  const [filesMetadata, setFilesMetadata] = useState<FileWithMetadata[]>([])
  const [imageList, setImageList] = useState<FlattenedModelImage[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegistryError, setIsRegistryError] = useState(false)
  const [currentFileUploadProgress, setCurrentFileUploadProgress] = useState<FileUploadProgress | undefined>(undefined)
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const router = useRouter()
  const sendNotification = useNotification()

  const { modelId }: { modelId?: string } = router.query
  const { model, isModelLoading, isModelError } = useGetModel(modelId, EntryKind.MODEL)

  const handleRegistryError = useCallback((value: boolean) => setIsRegistryError(value), [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!model) {
      return setErrorMessage('Please wait for the model to finish loading before trying to make a release.')
    }

    if (!model.card.version) {
      return setErrorMessage('Please make sure your model has a schema set before drafting a release.')
    }

    if (!isValidSemver(semver)) {
      return setErrorMessage('Please set a valid semver value before drafting a release.')
    }

    setErrorMessage('')
    setLoading(true)

    const fileIds: string[] = []
    for (const file of files) {
      if (isFileInterface(file)) {
        fileIds.push(file._id)
        continue
      }

      const metadata = filesMetadata.find((fileWithMetadata) => fileWithMetadata.fileName === file.name)?.metadata

      const handleUploadProgress = (progressEvent: AxiosProgressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setCurrentFileUploadProgress({ fileName: file.name, uploadProgress: percentCompleted })
        }
      }

      try {
        const fileUploadResponse = await postSimpleFileForRelease(model.id, file, handleUploadProgress, metadata)
        setCurrentFileUploadProgress(undefined)
        if (fileUploadResponse) {
          setUploadedFiles((uploadedFiles) => [...uploadedFiles, file.name])
          fileIds.push(fileUploadResponse.data.file._id)
        } else {
          setCurrentFileUploadProgress(undefined)
          return setLoading(false)
        }
      } catch (e) {
        if (e instanceof Error) {
          sendNotification({
            variant: 'error',
            msg: e.message,
          })
        }
      }
    }

    const release: CreateReleaseParams = {
      modelId: model.id,
      semver,
      modelCardVersion: model.card.version,
      notes: releaseNotes,
      minor: isMinorRelease,
      fileIds,
      images: imageList,
    }

    const response = await postRelease(release)

    if (!response.ok) {
      setErrorMessage(await getErrorMessage(response))
      setLoading(false)
    } else {
      const body = await response.json()
      setUploadedFiles([])
      setCurrentFileUploadProgress(undefined)
      router.push(`/model/${modelId}/release/${body.release.semver}`)
    }
  }

  const error = MultipleErrorWrapper(`Unable to load release page`, {
    isModelError,
  })
  if (error) return error

  return (
    <>
      <Title text='Draft New Release' />
      {isModelLoading && <Loading />}
      {model && !isModelLoading && (
        <Container maxWidth='md'>
          <Card sx={{ my: 4, p: 4 }}>
            <Box component='form' onSubmit={handleSubmit}>
              <Stack spacing={4}>
                <Link href={`/model/${modelId}?tab=releases`}>
                  <Button sx={{ width: 'fit-content' }} startIcon={<ArrowBack />}>
                    Back to model
                  </Button>
                </Link>
                <Stack spacing={2} alignItems='center' justifyContent='center'>
                  <Typography variant='h6' component='h1' color='primary'>
                    Draft New Release
                  </Typography>
                  <DesignServices color='primary' fontSize='large' />
                  <Typography>
                    A release takes a snapshot of the current state of the model code, files and model card. Access
                    requests will be able to select for any release of a model for deployment.
                  </Typography>
                </Stack>
                <ReleaseForm
                  model={model}
                  formData={{
                    semver,
                    releaseNotes,
                    isMinorRelease,
                    files,
                    imageList,
                  }}
                  onSemverChange={(value) => setSemver(value)}
                  onReleaseNotesChange={(value) => setReleaseNotes(value)}
                  onMinorReleaseChange={(value) => setIsMinorRelease(value)}
                  onFilesChange={(value) => setFiles(value)}
                  filesMetadata={filesMetadata}
                  onFilesMetadataChange={(value) => setFilesMetadata(value)}
                  onImageListChange={(value) => setImageList(value)}
                  onRegistryError={handleRegistryError}
                  currentFileUploadProgress={currentFileUploadProgress}
                  uploadedFiles={uploadedFiles}
                  filesToUploadCount={files.length}
                />
                <Stack alignItems='flex-end'>
                  <LoadingButton
                    variant='contained'
                    loading={loading}
                    type='submit'
                    disabled={!(semver && releaseNotes && isValidSemver(semver) && !isRegistryError)}
                    sx={{ width: 'fit-content' }}
                    data-test='createReleaseButton'
                  >
                    Create Release
                  </LoadingButton>
                  <MessageAlert message={errorMessage} severity='error' />
                </Stack>
              </Stack>
            </Box>
          </Card>
        </Container>
      )}
    </>
  )
}
