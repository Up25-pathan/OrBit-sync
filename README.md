# OrBit Backend Server

This folder contains the source code for the OrBit Web platform's backend services. 

## Core Responsibilities

1. **Authentication & Session Manager**: Validating developer user credentials, managing security sessions, and verifying tokens.
2. **License Key Cryptographics**: Provisioning license signatures (`orbit_dev_pk_...`), verifying daemon handshakes, and enforcing node clustering caps.
3. **Stripe Integration**: Listening to webhook events for invoicing and updating user tiers.
4. **Node Registry**: Database persistence layer storing active paired client platforms.

## Selected Stack
*(Pending stack choice: Node.js/Express, Rust/Axum, or Go/Gin)*
