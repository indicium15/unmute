import { createContext } from "react"
import type { User } from "firebase/auth"

export type ApprovalStatus = "approved" | "pending" | "revoked" | "unknown"

export interface AuthContextType {
  user: User | null
  loading: boolean
  approvalStatus: ApprovalStatus
  isAdmin: boolean
  signupRejected: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)
