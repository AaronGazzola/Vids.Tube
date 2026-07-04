## MODIFIED Requirements

### Requirement: Account signup

The system SHALL allow a visitor to create an account with a `@handle`, an email
address, and a password. Signup SHALL be enumeration-safe: the system MUST NOT
reveal, in the form response or any user-facing message, whether the submitted
email already has an account. The submission SHALL be handled by a server action
that performs any existence/confirmation check server-side (using the Supabase
admin client) so that this information never reaches the browser. In every case
the system SHALL surface a single, identical "check your email" outcome via a
toast notification and route the visitor to the verification page. The
difference between a new and an existing account SHALL be carried only by which
email is sent.

#### Scenario: Signup with a new email

- **WHEN** a visitor submits the signup form with an email that has no account
- **THEN** the system creates the account (reserving the `@handle`), sends the
  confirmation email, shows the "check your email" toast, and routes to the
  verification page

#### Scenario: Signup with an existing but unconfirmed email

- **WHEN** a visitor submits the signup form with an email that has an account
  whose email is not yet confirmed
- **THEN** the system (re)sends the confirmation email, shows the same "check
  your email" toast, and routes to the verification page, without creating a
  duplicate account and without indicating that the account already exists

#### Scenario: Signup with an existing, already-confirmed email

- **WHEN** a visitor submits the signup form with an email that has an account
  whose email is already confirmed
- **THEN** the system sends a magic-link sign-in email to that address (creating
  no new account), shows the same "check your email" toast, and routes to the
  verification page, without indicating that the account already exists

#### Scenario: No outcome difference is exposed to the client

- **WHEN** the signup server action completes for any of the above cases
- **THEN** it returns the same successful result and the client renders the same
  message, with no error toast or "account already exists" / "verification
  resent" wording

### Requirement: Email confirmation callback

The system SHALL provide an auth callback route that exchanges the confirmation
code from the verification email (or the magic-link sign-in email) for a session,
redirecting to the app on success and to an auth error page on failure.

#### Scenario: Valid confirmation code

- **WHEN** a user follows the verification or magic-link email and the callback
  receives a valid code
- **THEN** the system exchanges the code for a session and redirects to the
  intended destination

#### Scenario: Missing or invalid code

- **WHEN** the callback is reached without a valid code
- **THEN** the system redirects to the auth error page
