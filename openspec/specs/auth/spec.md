# auth Specification

## Purpose
TBD - created by archiving change add-foundation-and-auth. Update Purpose after archive.
## Requirements
### Requirement: Account signup

The system SHALL allow a visitor to create an account with an email address and
a password, using the Supabase browser client within a React Query mutation, and
SHALL surface the outcome via a toast notification.

#### Scenario: Successful signup

- **WHEN** a visitor submits the signup form with a new email and password
- **THEN** the system creates the account, shows a success toast indicating a
  verification email was sent, and routes the visitor to the verification page

#### Scenario: Signup with an already-registered email

- **WHEN** a visitor submits the signup form with an email that already has an
  account
- **THEN** the system resends the verification email and shows a notification
  toast, without creating a duplicate account

### Requirement: Email confirmation callback

The system SHALL provide an auth callback route that exchanges the confirmation
code from the verification email for a session, redirecting to the app on
success and to an auth error page on failure.

#### Scenario: Valid confirmation code

- **WHEN** a user follows the verification link and the callback receives a valid
  code
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

