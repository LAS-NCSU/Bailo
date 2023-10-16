import { Box, Button, Divider, Stack } from '@mui/material'
import { useEffect, useState } from 'react'

import { useGetModel } from '../../../../actions/model'
import { putModelCard, useModelCardRevisions } from '../../../../actions/modelCard'
import { useGetSchema } from '../../../../actions/schema'
import { useGetUiConfig } from '../../../../actions/uiConfig'
import { SplitSchemaNoRender } from '../../../../types/interfaces'
import { ModelInterface } from '../../../../types/v2/types'
import { getStepsData, getStepsFromSchema } from '../../../../utils/beta/formUtils'
import Loading from '../../../common/Loading'
import ModelCardForm from '../../../Form/beta/ModelCardForm'
import MessageAlert from '../../../MessageAlert'
import ModelCardHistoryDialog from '../overview/ModelCardHistoryDialog'

type FormEditPageProps = {
  model: ModelInterface
}

export default function FormEditPage({ model }: FormEditPageProps) {
  const [isEdit, setIsEdit] = useState(false)

  const { schema, isSchemaLoading, isSchemaError } = useGetSchema(model.card.schemaId)
  const { mutateModel } = useGetModel(model.id)
  const { mutateModelCardRevisions } = useModelCardRevisions(model.id)
  const [splitSchema, setSplitSchema] = useState<SplitSchemaNoRender>({ reference: '', steps: [] })
  const { uiConfig: _uiConfig, isUiConfigLoading, isUiConfigError } = useGetUiConfig()
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleEdit = () => {
    setIsEdit(true)
  }

  async function onSubmit() {
    if (schema) {
      const data = getStepsData(splitSchema, true)
      data.schemaRef = schema.id
      const res = await putModelCard(model.id, data)
      if (res.status && res.status < 400) {
        setIsEdit(false)

        mutateModelCardRevisions()
      }
    }
  }

  function onCancel() {
    if (schema) {
      mutateModel()
      const steps = getStepsFromSchema(schema, {}, ['properties.contacts'], model.card.metadata)
      for (const step of steps) {
        step.steps = steps
      }
      setSplitSchema({ reference: schema.id, steps })
      setIsEdit(false)
    }
  }

  useEffect(() => {
    if (!model || !schema) return
    const metadata = model.card.metadata
    const steps = getStepsFromSchema(schema, {}, ['properties.contacts'], metadata)

    for (const step of steps) {
      step.steps = steps
    }

    setSplitSchema({ reference: schema.id, steps })
  }, [schema, model])

  if (isSchemaError) {
    return <MessageAlert message={isSchemaError.info.message} severity='error' />
  }

  if (isUiConfigError) {
    return <MessageAlert message={isUiConfigError.info.message} severity='error' />
  }
  return (
    <>
      {(isSchemaLoading || isUiConfigLoading) && <Loading />}
      <Box sx={{ py: 1 }}>
        <Stack
          direction='row'
          spacing={1}
          justifyContent='flex-end'
          divider={<Divider orientation='vertical' flexItem />}
          sx={{ mb: { xs: 2 } }}
        >
          {!isEdit && (
            <Button variant='outlined' onClick={() => setDialogOpen(true)}>
              View History
            </Button>
          )}
          {!isEdit && (
            <Button variant='outlined' onClick={handleEdit}>
              Edit Model card
            </Button>
          )}
          {isEdit && (
            <Button variant='outlined' onClick={onCancel}>
              Cancel
            </Button>
          )}
          {isEdit && (
            <Button variant='contained' onClick={onSubmit}>
              Save
            </Button>
          )}
        </Stack>
        <ModelCardForm splitSchema={splitSchema} setSplitSchema={setSplitSchema} canEdit={isEdit} />
      </Box>
      <ModelCardHistoryDialog model={model} open={dialogOpen} setOpen={setDialogOpen} />
    </>
  )
}
