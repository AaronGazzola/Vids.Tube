## ADDED Requirements

### Requirement: Nightbot token self-renewal

The system SHALL treat the Nightbot access token as renewable state rather
than a static secret. The worker SHALL refresh the token via Nightbot's
`oauth2/token` refresh grant — using the stored refresh token and client
credentials — whenever the recorded expiry is unknown or less than 5 days
away, and immediately when a send returns HTTP 401 (retrying that send once
with the new token). Each successful refresh SHALL replace the access token,
refresh token, and expiry both in the running process and in Doppler. A failed
refresh SHALL be logged with at most one attempt per hour and SHALL NOT
affect vids.tube VidsBot replies; YouTube sends then fall back to the existing
skip behavior.

#### Scenario: Renew-ahead at startup

- **WHEN** the worker starts and `NIGHTBOT_TOKEN_EXPIRES_AT` is less than 5
  days away
- **THEN** the worker exchanges the refresh token for a new pair, uses it for
  subsequent sends, and persists the new token, refresh token, and expiry to
  Doppler

#### Scenario: Expired token during a send

- **WHEN** a Nightbot send returns HTTP 401
- **THEN** the worker refreshes once and retries that send once with the new
  token; a second failure is logged and the message dropped

#### Scenario: Refresh failure is non-fatal

- **WHEN** the refresh grant fails (revoked refresh token, network error)
- **THEN** the failure is logged (no more than once per hour), YouTube sends
  skip as if unconfigured, and vids.tube replies continue unaffected
