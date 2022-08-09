/**
 * @jest-environment jsdom
 */

import MultipleErrorWrapper from './MultipleErrorWrapper'
import { render, screen, waitFor } from '@testing-library/react'

describe('MultipleErrorWrapper', () => {
  const error1 = {}
  const error2 = {}

  const errorWrapper = MultipleErrorWrapper(`There was an error!`, {
    error1,
    error2,
  })

  it('renders an MultipleErrorWrapper component', async () => {
    render(errorWrapper!)

    await waitFor(async () => {
      expect(await screen.findByText('There was an error!')).not.toBeUndefined()
    })
  })
})