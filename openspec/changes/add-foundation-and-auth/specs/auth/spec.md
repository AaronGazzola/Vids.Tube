## ADDED Requirements

### Requirement: Account signup

The system SHALL allow a visitor to create an account with an email address and
a password.

#### Scenario: Successful signup

- **WHEN** a visitor submits the signup form with a new email and a password of
  at least 6 characters
- **THEN** the system creates an account, establishes an authenticated session,
  and redirects to the home page

#### Scenario: Signup with an already-registered email

- **WHEN** a visitor submits the signup form with an email that already has an
  account
- **THEN** the system does not create a duplicate account and redirects back to
  the signup page with an error message

### Requirement: Account login

The system SHALL allow a registered user to log in with their email and password.

#### Scenario: Successful login

- **WHEN** a registered user submits the login form with correct credentials
- **THEN** the system establishes an authenticated session and redirects to the
  home page

#### Scenario: Login with incorrect credentials

- **WHEN** a user submits the login form with an incorrect password
- **THEN** the system does not establish a session and redirects back to the
  login page with an error message

### Requirement: Logout

The system SHALL allow an authenticated user to end their session.

#### Scenario: Successful logout

- **WHEN** an authenticated user activates sign-out
- **THEN** the system clears the session and the navigation shows logged-out
  controls (Log in / Sign up)

### Requirement: Session persistence and refresh

The system SHALL persist the authenticated session in cookies and refresh the
auth token on each request via middleware.

#### Scenario: Session survives navigation

- **WHEN** an authenticated user navigates between pages
- **THEN** the user remains authenticated without re-entering credentials

### Requirement: Trustworthy server-side current-user check

The system SHALL provide a server-side helper that determines the current user
using verified claims, and SHALL NOT rely on unverified session reads for
authorization decisions.

#### Scenario: Protected access for an authenticated user

- **WHEN** server code calls the require-user helper while a valid session exists
- **THEN** the helper returns the user's verified claims

#### Scenario: Protected access for an anonymous visitor

- **WHEN** server code calls the require-user helper with no valid session
- **THEN** the helper redirects the visitor to the login page

#### Scenario: Optional user check when logged out

- **WHEN** server code calls the optional-user helper with no valid session
- **THEN** the helper returns no user without redirecting
