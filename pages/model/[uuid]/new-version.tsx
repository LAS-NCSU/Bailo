import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

import Paper from '@mui/material/Paper'
import { useGetModel } from '../../../data/model'

import Wrapper from '../../../src/Wrapper'
import { useGetSchema } from '../../../data/schema'
import MultipleErrorWrapper from '../../../src/errors/MultipleErrorWrapper'
import { SplitSchema } from '../../../types/interfaces'
import { createStep, getStepsData, getStepsFromSchema } from '../../../utils/formUtils'

import SubmissionError from '../../../src/Form/SubmissionError'
import Form from '../../../src/Form/Form'
import RenderFileTab, { FileTabComplete } from '../../../src/Form/RenderFileTab'
import useCacheVariable from '../../../utils/useCacheVariable'
import { getErrorMessage } from '../../../utils/fetcher'

const uiSchema = {
  contacts: {
    uploader: { 'ui:widget': 'userSelector' },
    reviewer: { 'ui:widget': 'userSelector' },
    manager: { 'ui:widget': 'userSelector' },
  },
}

function Upload() {
  const router = useRouter()
  const { uuid: modelUuid }: { uuid?: string } = router.query

  const { model, isModelLoading, isModelError } = useGetModel(modelUuid)
  const { schema, isSchemaLoading, isSchemaError } = useGetSchema(model?.schemaRef)

  const cModel = useCacheVariable(model)
  const cSchema = useCacheVariable(schema)

  const [splitSchema, setSplitSchema] = useState<SplitSchema>({ reference: '', steps: [] })
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!cSchema || !cModel) return
    const steps = getStepsFromSchema(cSchema, uiSchema, [], cModel.currentMetadata)

    steps.push(
      createStep({
        schema: {
          title: 'Files',
        },
        state: {
          binary: undefined,
          code: undefined,
        },
        schemaRef: cModel.schemaRef,

        type: 'Data',
        index: steps.length,
        section: 'files',

        render: RenderFileTab,
        isComplete: FileTabComplete,
      })
    )

    setSplitSchema({ reference: cSchema.reference, steps })
  }, [cModel, cSchema])

  const errorWrapper = MultipleErrorWrapper(`Unable to load edit page`, {
    isModelError,
    isSchemaError,
  })
  if (errorWrapper) return errorWrapper

  if (isModelLoading || isSchemaLoading) {
    return null
  }

  if (!model || !schema) {
    return null
  }

  const onSubmit = async () => {
    setError(undefined)

    const data = getStepsData(splitSchema, true)
    const form = new FormData()

    data.schemaRef = model?.schemaRef

    form.append('code', data.files.code)
    form.append('binary', data.files.binary)

    delete data.files

    form.append('metadata', JSON.stringify(data))

    const upload = await fetch(`/api/v1/model?mode=newVersion&modelUuid=${model.uuid}`, {
      method: 'POST',
      body: form,
    })

    if (upload.status >= 400) {
      return setError(await getErrorMessage(upload))
    }

    const { uuid } = await upload.json()
    router.push(`/model/${uuid}`)
  }

  return (
    <Paper variant='outlined' sx={{ my: { xs: 3, md: 6 }, p: { xs: 2, md: 3 } }}>
      <SubmissionError error={error} />
      <Form splitSchema={splitSchema} setSplitSchema={setSplitSchema} onSubmit={onSubmit} />
    </Paper>
  )
}

export default function Outer() {
  return (
    <Wrapper title='Upload Model' page='upload'>
      <Upload />
    </Wrapper>
  )
}
