namespace Parking.Identity.Application.Common.Enum
{
    public static class ErrorCode
    {
        // =========================
        // ACCOUNT
        // =========================

        public const string AccountNotFound = "ACCOUNT_NOT_FOUND";
        public const string AccountAlreadyExists = "ACCOUNT_ALREADY_EXISTS";
        public const string InvalidAccount = "INVALID_ACCOUNT";
        public const string AccountCreationFailed = "ACCOUNT_CREATION_FAILED";
        public const string AccountUpdateFailed = "ACCOUNT_UPDATE_FAILED";
        public const string AccountDeleteFailed = "ACCOUNT_DELETE_FAILED";

        // =========================
        // EMAIL
        // =========================

        public const string EmailAlreadyExists = "EMAIL_ALREADY_EXISTS";
        public const string EmailNotFound = "EMAIL_NOT_FOUND";
        public const string InvalidEmail = "INVALID_EMAIL";
        public const string EmailNotVerified = "EMAIL_NOT_VERIFIED";
        public const string EmailAlreadyVerified = "EMAIL_ALREADY_VERIFIED";

        // =========================
        // PHONE
        // =========================

        public const string PhoneAlreadyExists = "PHONE_ALREADY_EXISTS";
        public const string PhoneNotFound = "PHONE_NOT_FOUND";
        public const string InvalidPhone = "INVALID_PHONE";
        public const string PhoneNotVerified = "PHONE_NOT_VERIFIED";
        public const string PhoneAlreadyVerified = "PHONE_ALREADY_VERIFIED";

        // =========================
        // AUTHENTICATION
        // =========================

        public const string InvalidCredentials = "INVALID_CREDENTIALS";
        public const string InvalidPassword = "INVALID_PASSWORD";
        public const string PasswordIncorrect = "PASSWORD_INCORRECT";
        public const string PasswordChangeFailed = "PASSWORD_CHANGE_FAILED";

        // =========================
        // AUTHORIZATION
        // =========================

        public const string Unauthorized = "UNAUTHORIZED";
        public const string Forbidden = "FORBIDDEN";
        public const string TokenMissing = "TOKEN_MISSING";
        public const string InvalidToken = "INVALID_TOKEN";
        public const string TokenExpired = "TOKEN_EXPIRED";

        // =========================
        // ACCOUNT STATUS
        // =========================

        public const string AccountLocked = "ACCOUNT_LOCKED";
        public const string AccountDisabled = "ACCOUNT_DISABLED";
        public const string AccountInactive = "ACCOUNT_INACTIVE";

        // =========================
        // VALIDATION
        // =========================

        public const string InvalidRequest = "INVALID_REQUEST";
        public const string RequiredFieldMissing = "REQUIRED_FIELD_MISSING";
        public const string InvalidId = "INVALID_ID";

        // =========================
        // SYSTEM
        // =========================

        public const string DatabaseError = "DATABASE_ERROR";
        public const string InternalServerError = "INTERNAL_SERVER_ERROR";
        public const string ServiceUnavailable = "SERVICE_UNAVAILABLE";

        public const string ClientIDNotFound = "CLIENT_ID_NOT_FOUND";

        // =========================
        // OTP (Mới bổ sung cho tính năng quên mật khẩu)
        // =========================

        public const string OtpNotFound = "OTP_NOT_FOUND";
        public const string OtpExpired = "OTP_EXPIRED";
        public const string OtpInvalid = "OTP_INVALID";
        public const string OtpAlreadyUsed = "OTP_ALREADY_USED";
        public const string OtpMaxAttemptsExceeded = "OTP_MAX_ATTEMPTS_EXCEEDED";
    }
}

