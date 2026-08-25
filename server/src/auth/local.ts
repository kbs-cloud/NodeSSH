import bcrypt from 'bcryptjs';
import { createUser, findUserByUsername, findUserById, toUserDTO } from '../db/users';
import { generateToken } from './middleware';
import { UserDTO } from '../types';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function registerLocalUser(
  username: string,
  password?: string,
  email?: string
): Promise<{ token: string; user: UserDTO }> {
  if (!username || !username.trim()) {
    throw new Error('Username is required');
  }

  const existing = findUserByUsername(username.trim());
  if (existing) {
    throw new Error('Username is already in use');
  }

  let passwordHash: string | null = null;
  if (password && password.trim()) {
    passwordHash = await hashPassword(password);
  }

  const user = createUser({
    username: username.trim(),
    password_hash: passwordHash,
    email: email ? email.trim() : null,
  });

  const userDTO = toUserDTO(user);
  const token = generateToken({
    userId: user.id,
    username: user.username,
    email: user.email,
  });

  return { token, user: userDTO };
}

export async function loginLocalUser(
  username: string,
  password?: string
): Promise<{ token: string; user: UserDTO }> {
  if (!username || !username.trim()) {
    throw new Error('Username is required');
  }

  const user = findUserByUsername(username.trim());
  if (!user) {
    throw new Error('Invalid username or password');
  }

  if (user.password_hash) {
    if (!password) {
      throw new Error('Password is required');
    }
    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid username or password');
    }
  }

  const userDTO = toUserDTO(user);
  const token = generateToken({
    userId: user.id,
    username: user.username,
    email: user.email,
  });

  return { token, user: userDTO };
}
