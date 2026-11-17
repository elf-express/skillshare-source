# auth Specification

## Purpose
後台登入的帳號密碼驗證與 session 管理。

## Requirements

### Requirement: Password login

使用者 SHALL 以帳號與密碼登入後台。

#### Scenario: Valid credentials

- **WHEN** 使用者輸入正確的帳號與密碼
- **THEN** 系統建立 session 並導向首頁

### Requirement: Session timeout

閒置超過 30 分鐘的 session SHALL 失效。

#### Scenario: Idle session expires

- **WHEN** 使用者閒置 31 分鐘後操作
- **THEN** 系統導回登入頁
