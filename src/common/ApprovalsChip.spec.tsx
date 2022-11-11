/**
 * @jest-environment jsdom
 */

import { ThemeProvider } from '@mui/material/styles'
import { render, screen, waitFor } from '@testing-library/react'
import { ApprovalStates } from '../../types/interfaces'
import { lightTheme } from '../theme'
import ApprovalsChip from './ApprovalsChip'

describe('ApprovalsChip', () => {
  it('renders an ApprovalsChip component with 0/2 approvals', async () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <ApprovalsChip
          approvals={[
            { reviewer: 'Alice', status: ApprovalStates.NoResponse },
            { reviewer: 'Bob', status: ApprovalStates.NoResponse },
          ]}
        />
      </ThemeProvider>
    )

    await waitFor(async () => {
      expect(await screen.findByText('Approvals 0/2')).not.toBeUndefined()
    })
  })

  it('renders an ApprovalsChip component with 1/2 approvals', async () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <ApprovalsChip
          approvals={[
            { reviewer: 'Alice', status: ApprovalStates.Accepted },
            { reviewer: 'Bob', status: ApprovalStates.NoResponse },
          ]}
        />
      </ThemeProvider>
    )

    await waitFor(async () => {
      expect(await screen.findByText('Approvals 1/2')).not.toBeUndefined()
    })
  })

  it('renders an ApprovalsChip component with 2/2 approvals', async () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <ApprovalsChip
          approvals={[
            { reviewer: 'Alice', status: ApprovalStates.Accepted },
            { reviewer: 'Bob', status: ApprovalStates.Accepted },
          ]}
        />
      </ThemeProvider>
    )

    await waitFor(async () => {
      expect(await screen.findByText('Approvals 2/2')).not.toBeUndefined()
    })
  })

  it('renders an ApprovalsChip component with 0/1 approvals', async () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <ApprovalsChip approvals={[{ reviewer: 'Alice', status: ApprovalStates.NoResponse }]} />
      </ThemeProvider>
    )

    await waitFor(async () => {
      expect(await screen.findByText('Approvals 0/1')).not.toBeUndefined()
    })
  })

  it('renders an ApprovalsChip component with 1/1 approvals', async () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <ApprovalsChip approvals={[{ reviewer: 'Alice', status: ApprovalStates.Accepted }]} />
      </ThemeProvider>
    )

    await waitFor(async () => {
      expect(await screen.findByText('Approvals 1/1')).not.toBeUndefined()
    })
  })
})
