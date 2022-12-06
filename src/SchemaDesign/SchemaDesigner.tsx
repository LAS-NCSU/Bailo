/* eslint-disable react/jsx-props-no-spreading */
import { Schema, SchemaQuestion, SplitSchema, SchemaType, Step } from '@/types/interfaces'
import { withTheme } from '@rjsf/core'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import React, { useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { getStepsFromSchema } from '@/utils/formUtils'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Icon from '@mui/material/Icon'
import AddIcon from '@mui/icons-material/Add'
import TextFieldsIcon from '@mui/icons-material/TextFields'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContentText from '@mui/material/DialogContentText'
import _ from 'lodash'
import Grid from '@mui/material/Grid'
import { Theme as MaterialUITheme } from '../MuiForms'
import QuestionPicker from './QuestionPicker'

const SchemaForm = withTheme(MaterialUITheme)

export default function SchemaDesigner() {
  const [questionPickerOpen, setQuestionPickerOpen] = React.useState(false)
  const [steps, setSteps] = React.useState<any[]>([])
  const [stepName, setStepName] = React.useState('')
  const [stepReference, setStepReference] = React.useState('')
  const [selectedStep, setSelectedStep] = React.useState('')
  const [splitSchema, setSplitSchema] = React.useState<SplitSchema>({ reference: '', steps: [] })
  const [schemaName, setSchemaName] = React.useState('')
  const [showForm, setShowForm] = React.useState(true)
  const [schemaReference, setSchemaReference] = React.useState('')
  const [schemaUse, setSchemaUse] = React.useState<SchemaType>('UPLOAD')
  const [newStepDialogOpen, setNewStepDialogOpen] = React.useState(false)
  const [submitSchemaDialogOpen, setSubmitSchemaDialogOpen] = React.useState(false)
  const [schemaDetails, setSchemaDetails] = React.useState({
    name: '',
    reference: '',
    use: '',
  })

  const stepIndex = steps.findIndex((step) => step.reference === selectedStep)

  useEffect(() => {
    if (steps.length > 0) {
      const userSteps = {}
      steps.forEach((step) => {
        const stepToAdd = {
          [step.reference]: {
            title: step.title,
            type: 'object',
            properties: {},
          },
        }
        if (step.questions && step.questions.length > 0) {
          step.questions.forEach((question) => {
            const questionReference = question.reference
            const questionToAdd = {
              [questionReference]: { ...question },
            }
            delete questionToAdd[questionReference].reference
            stepToAdd[step.reference].properties = { ...stepToAdd[step.reference].properties, ...questionToAdd }
          })
          Object.assign(userSteps, stepToAdd)
        }
      })
      const userSchema: Schema = {
        name: '',
        reference: '',
        schema: {
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'object',
          properties: {
            id: {
              type: 'string',
            },
            timeStamp: {
              type: 'string',
              format: 'date-time',
            },
            schemaRef: {
              title: 'Schema reference',
              type: 'string',
            },
            ...userSteps,
          },
        },
        use: 'UPLOAD',
      }
      const { reference } = userSchema
      const schemaSteps: Step[] = getStepsFromSchema(userSchema, {}, [])
      setSplitSchema({ reference, steps: schemaSteps })
      setShowForm(false)
    }
  }, [schemaDetails, steps, setSplitSchema])

  // This is the only way we can find to force the form to rerender
  useEffect(() => {
    if (!showForm) setShowForm(true)
  }, [showForm])

  const handleStepChange = (_event, newValue) => {
    setSelectedStep(newValue)
  }

  const handleClickOpen = () => {
    setQuestionPickerOpen(true)
  }

  const handleQuestionPickerClose = () => {
    setQuestionPickerOpen(false)
  }

  const addNewStep = (event) => {
    event.preventDefault()
    setNewStepDialogOpen(false)
    if (steps.filter((step) => step.title === stepName).length === 0) {
      const newStep = {
        title: stepName,
        reference: stepReference,
        questions: [],
      }
      newStep.reference = stepReference === '' ? _.camelCase(stepName) : _.camelCase(stepReference)
      setSteps((oldSteps) => [...oldSteps, newStep])
      setSelectedStep(stepReference === '' ? _.camelCase(stepName) : _.camelCase(stepReference))
      setStepName('')
      setStepReference('')
    }
  }

  const addQuestion = (data: SchemaQuestion) => {
    const question = data
    question.reference = data.reference === '' ? _.camelCase(data.title) : _.camelCase(data.reference)
    const updatedSteps = steps
    const stepToAmmend = updatedSteps.find((step) => step.reference === selectedStep)
    const updatedQuestions = stepToAmmend.questions
    updatedQuestions.push(data)
    setSteps(steps.map((step) => (step.reference === selectedStep ? { ...step, questions: updatedQuestions } : step)))
  }

  const submitSchema = () => {
    // setSchemaDetails({
    //   name: schemaName,
    //   reference: schemaReference,
    //   use: schemaUse,
    // })
  }

  const reorder = (list, startIndex, endIndex) => {
    const result = Array.from(list)
    const [removed] = result.splice(startIndex, 1)
    result.splice(endIndex, 0, removed)

    return result
  }

  const onDragEnd = (result) => {
    if (!result.destination) {
      return
    }
    if (result.destination.index === result.source.index) {
      return
    }
    const stepToAmmend = steps.find((step) => step.reference === selectedStep)
    const updatedQuestions = reorder(stepToAmmend.questions, result.source.index, result.destination.index)

    setSteps(steps.map((step) => (step.reference === selectedStep ? { ...step, questions: updatedQuestions } : step)))
  }

  const getQuestionIcon = (type) => {
    if (type === 'date') {
      return <CalendarMonthIcon />
    }
    if (type === 'boolean') {
      return <CheckBoxIcon />
    }
    return <TextFieldsIcon />
  }

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={12} md={6}>
          <Box>
            <Typography sx={{ mb: 2 }} variant='h4'>
              Configure Schema
            </Typography>
            <Paper
              sx={{
                p: 2,
              }}
            >
              <Stack direction='row' spacing={2}>
                <Tabs value={selectedStep} onChange={handleStepChange} variant='scrollable' scrollButtons='auto'>
                  {steps.map((step) => (
                    <Tab key={step.reference} value={step.reference} label={step.title} />
                  ))}
                </Tabs>
                <Button
                  color='primary'
                  variant='text'
                  startIcon={<AddIcon />}
                  onClick={() => setNewStepDialogOpen(true)}
                >
                  Add step
                </Button>
              </Stack>

              {steps.map((step) => (
                <Box key={step.reference}>
                  {step.reference === selectedStep && (
                    <Box sx={{ pt: 2 }}>
                      <Typography variant='caption'>Questions can be reordered by drag and drop</Typography>
                      <DragDropContext onDragEnd={onDragEnd}>
                        <Droppable droppableId='list'>
                          {(droppableProvided) => (
                            <div {...droppableProvided.droppableProps} ref={droppableProvided.innerRef}>
                              {step.questions.map((question, index) => (
                                <Draggable key={question.title} draggableId={question.title} index={index}>
                                  {(draggableProvided) => (
                                    <div
                                      ref={draggableProvided.innerRef}
                                      {...draggableProvided.draggableProps}
                                      {...draggableProvided.dragHandleProps}
                                    >
                                      <Box sx={{ m: 2 }}>
                                        <Stack direction='row' spacing={2}>
                                          <Icon color='primary'>{getQuestionIcon(question.type)}</Icon>
                                          <Typography key={question.title}>{question.title}</Typography>
                                        </Stack>
                                      </Box>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {droppableProvided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </DragDropContext>
                      <Button onClick={handleClickOpen}>Add new question</Button>
                    </Box>
                  )}
                </Box>
              ))}
              {selectedStep === '' && <Typography>Add a new step to begin designing your schema</Typography>}
            </Paper>
          </Box>
        </Grid>
        <Grid item xs={12} sm={12} md={6}>
          <Typography sx={{ mb: 2 }} variant='h4'>
            Preview
          </Typography>
          <Paper
            sx={{
              p: 2,
              width: '100%',
            }}
          >
            {showForm && splitSchema?.steps[stepIndex]?.schema === undefined && (
              <Typography>Nothing to preview!</Typography>
            )}
            {showForm && splitSchema?.steps[stepIndex]?.schema !== undefined && (
              <SchemaForm
                schema={splitSchema.steps[stepIndex].schema}
                formData={splitSchema.steps[stepIndex].state}
                uiSchema={splitSchema.steps[stepIndex].uiSchema}
              >
                {/* eslint-disable-next-line react/jsx-no-useless-fragment */}
                <></>
              </SchemaForm>
            )}
          </Paper>
        </Grid>
      </Grid>
      <Divider orientation='horizontal' flexItem sx={{ mt: 4, mb: 4 }} />
      <Box sx={{ textAlign: 'right' }}>
        <Button variant='contained' onClick={() => setSubmitSchemaDialogOpen(true)} disabled={steps.length === 0}>
          Submit schema
        </Button>
      </Box>
      <QuestionPicker
        onSubmit={addQuestion}
        handleClose={handleQuestionPickerClose}
        questionPickerOpen={questionPickerOpen}
      />
      <Dialog open={newStepDialogOpen} onClose={() => setNewStepDialogOpen(false)}>
        <DialogTitle>Add new Step</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The step reference must be unique, if it is left blank it will be generated automatically using the step
            name. The step name is the title displayed on the form itself.
          </DialogContentText>
          <Stack direction='row' spacing={2} sx={{ pt: 2 }}>
            <TextField
              label='Step reference'
              onChange={(event): void => setStepReference(event.target.value)}
              value={stepReference}
            />
            <TextField
              required
              label='Step name'
              onChange={(event): void => setStepName(event.target.value)}
              value={stepName}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewStepDialogOpen(false)}>Cancel</Button>
          <Button onClick={addNewStep}>Add Step</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={submitSchemaDialogOpen} onClose={() => setSubmitSchemaDialogOpen(false)}>
        <DialogTitle>Submit schema</DialogTitle>
        <DialogContent>
          <DialogContentText>Submit your schema</DialogContentText>
          <Stack spacing={1}>
            <TextField
              required
              label='Schema reference'
              onChange={(event): void => setSchemaReference(event.target.value)}
              value={schemaReference}
            />
            <TextField
              required
              label='Schema name'
              onChange={(event): void => setSchemaName(event.target.value)}
              value={schemaName}
            />
            <InputLabel id='schema-use-label'>Schema Type</InputLabel>
            <Select
              labelId='schema-use-label'
              id='demo-simple-select'
              value={schemaUse}
              label='Schema Type'
              onChange={(event): void => setSchemaUse(event.target.value as SchemaType)}
            >
              <MenuItem value='UPLOAD'>Upload</MenuItem>
              <MenuItem value='DEPLOYMENT'>Deployment</MenuItem>
            </Select>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmitSchemaDialogOpen(false)}>Cancel</Button>
          <Button onClick={submitSchema}>Submit</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
