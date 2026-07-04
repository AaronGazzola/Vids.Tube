# auth Specification

## Purpose
TBD - created by archiving change add-foundation-and-auth. Update Purpose after archive.
## Requirements
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

### Requirement: Account login

The system SHALL allow a registered user to log in with their email and password
via the Supabase browser client within a React Query mutation.

#### Scenario: Successful login

- **WHEN** a registered, verified user submits the login form with correct
  credentials
- **THEN** the system establishes an authenticated session, invalidates the
  cached user query, shows a success toast, and reflects the logged-in state

#### Scenario: Login with incorrect credentials

- **WHEN** a user submits the login form with an incorrect password
- **THEN** the system does not establish a session and shows an error toast

### Requirement: Logout

The system SHALL allow an authenticated user to end their session via the
Supabase browser client within a React Query mutation.

#### Scenario: Successful logout

- **WHEN** an authenticated user activates sign-out
- **THEN** the system clears the session, invalidates the cached user query, and
  the navigation shows logged-out controls (Log in / Sign up)

### Requirement: Client-managed auth state

The system SHALL hold the current user and authentication flag in a client store
(`useAuthStore`) and SHALL derive UI state (such as navigation) from it, without
using middleware.

#### Scenario: Auth state available across the app

- **WHEN** a user is authenticated
- **THEN** components reading the auth store see `isAuthenticated` true and the
  user record, and render authenticated UI

#### Scenario: Auth state cleared on logout

- **WHEN** the user signs out
- **THEN** the auth store reports `isAuthenticated` false and a null user

### Requirement: Server actions validate the authenticated user

Server actions that perform authenticated database operations SHALL validate the
caller with `auth.getUser()` before any query, and SHALL throw (no fallback) when
the user is missing or unauthorized, logging the error with `console.error`.

#### Scenario: Authorized action proceeds

- **WHEN** an authenticated user invokes an action that calls `auth.getUser()`
  successfully
- **THEN** the action performs its query and returns the result

#### Scenario: Unauthenticated action is rejected

- **WHEN** an action calls `auth.getUser()` and no valid user is present
- **THEN** the action throws an "Unauthorized" error and performs no query

### Requirement: Route protection via data queries

The system SHALL gate protected routes and features using database queries
implemented in React Query hooks, not middleware.

#### Scenario: Protected feature denied without access

- **WHEN** a user without the required ownership/permission loads a gated feature
- **THEN** the gating React Query hook's underlying query returns no authorizing
  row and the UI withholds the protected content

#### Scenario: Protected feature allowed with access

- **WHEN** a user with the required ownership/permission loads a gated feature
- **THEN** the gating query returns the authorizing row and the UI renders the
  protected content

