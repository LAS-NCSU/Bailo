/**
 * @jest-environment jsdom
 */

import Wrapper from './Wrapper'
import { render, screen, waitFor } from '@testing-library/react'
import ThemeProvider from '@mui/system/ThemeProvider'
import { lightTheme } from './theme'

describe('Wrapper', () => {
  it('renders a Wrapper component', async () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <Wrapper title='marketplace' page='/' />
      </ThemeProvider>
    )

    await waitFor(async () => {
      expect(await screen.findByText('marketplace')).not.toBeUndefined()
    })
  })
})
