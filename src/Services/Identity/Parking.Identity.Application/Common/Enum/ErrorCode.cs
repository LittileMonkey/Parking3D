using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.Common.Enum
{
    public enum ErrorCode
    {
        // =========================
        // ACCOUNT
        // =========================

        AccountNotFound = 1001,
        AccountAlreadyExists = 1002,
        InvalidAccount = 1003,
        AccountCreationFailed = 1004,
        AccountUpdateFailed = 1005,
        AccountDeleteFailed = 1006,

        // =========================
        // EMAIL
        // =========================

        EmailAlreadyExists = 1101,
        EmailNotFound = 1102,
        InvalidEmail = 1103,
        EmailNotVerified = 1104,
        EmailAlreadyVerified = 1105,

        // =========================
        // PHONE
        // =========================

        PhoneAlreadyExists = 1201,
        PhoneNotFound = 1202,
        InvalidPhone = 1203,
        PhoneNotVerified = 1204,
        PhoneAlreadyVerified = 1205,

        // =========================
        // AUTHENTICATION
        // =========================

        InvalidCredentials = 1301,
        InvalidPassword = 1302,
        PasswordIncorrect = 1303,
        PasswordChangeFailed = 1304,

        // =========================
        // AUTHORIZATION
        // =========================

        Unauthorized = 1401,
        Forbidden = 1402,
        TokenMissing = 1403,
        InvalidToken = 1404,
        TokenExpired = 1405,

        // =========================
        // ACCOUNT STATUS
        // =========================

        AccountLocked = 1501,
        AccountDisabled = 1502,
        AccountInactive = 1503,

        // =========================
        // VALIDATION
        // =========================

        InvalidRequest = 1601,
        RequiredFieldMissing = 1602,
        InvalidId = 1603,

        // =========================
        // SYSTEM
        // =========================

        DatabaseError = 9001,
        InternalServerError = 9002,
        ServiceUnavailable = 9003
    }
}

