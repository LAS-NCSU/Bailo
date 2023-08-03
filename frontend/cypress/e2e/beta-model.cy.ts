const betaModelUrl = 'localhost:8080/beta/model/new/model'

describe('Beta create new model', () => {
  it('loads the Create a new model Page', () => {
    cy.visit(betaModelUrl)
    cy.get('[data-test=createModelPageTitle]').contains('Create a new model')
  })

  it('creates a public new model', () => {
    cy.visit(betaModelUrl)

    cy.get('[data-test=team-selector]').click()
    cy.get('[role=presentation]').click()
    cy.get('[data-test=model-selector]').type('test model')
    cy.get('[data-test=modelDescription]').type('test description')

    cy.get('[data-test=privateButtonSelector]').click()
    cy.get('[data-test=createModelButton]').click()
    cy.wait(500)
    cy.get('[data-test=createModelCardOverview]')
  })

  it('creates a private new model', () => {
    cy.visit(betaModelUrl)

    cy.get('[data-test=team-selector]').type('test team')
    cy.get('[data-test=model-selector]').type('test model')
    cy.get('[data-test=modelDescription]').type('test description')

    cy.get('[data-test=privateButtonSelector]').click()
    cy.get('[data-test=createModelButton]').click()
    cy.wait(500)
    cy.get('[data-test=createModelCardOverview]')
  })
})
