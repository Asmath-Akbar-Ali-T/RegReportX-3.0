export interface User {
  id?: number;
  name: string;
  username: string;
  email: string;
  password?: string;
  role: string;
  status: string;
  createdAt?: string;
}
