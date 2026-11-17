export interface RegistrationInput {
  email: string;
  fullName: string;
  phoneE164: string;
  password: string;
}

export function normalizePhoneNumber(value: string) {
  let phone = value.trim().replace(/[\s().-]/g, "");
  if (/^0[1-9]\d{8}$/.test(phone)) phone = `+84${phone.slice(1)}`;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new Error("Số điện thoại chưa hợp lệ. Nhập số Việt Nam như 0912345678 hoặc số quốc tế có dấu +.");
  }
  return phone;
}

export function createRegistrationRequest(input: RegistrationInput) {
  return {
    emailNormalized: input.email.trim().toUpperCase(),
    fullName: input.fullName.trim(),
    phoneE164: normalizePhoneNumber(input.phoneE164),
    password: input.password,
  };
}
