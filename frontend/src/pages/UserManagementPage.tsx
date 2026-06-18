import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Loader2,
  Shield,
  User,
  Camera,
  Upload,
  ImagePlus,
  CheckCircle2,
  AlertCircle,
  Brain,
  Terminal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import apiClient from "../lib/axios"
import { useAuth, UserRole } from "../contexts/AuthContext"

type Role = {
  id: number
  name: string
}

type Zone = {
  id: number
  name: string
}

type ZonePermission = {
  id: number
  zone: Zone
}

type UserType = {
  id: number
  employee_id: string
  name: string
  email: string
  role_id: number
  is_active: boolean
  profile_image: string | null
  is_trained: boolean
  created_at: string
  role?: Role
  zone_permissions: ZonePermission[]
}

type PaginatedResponse = {
  success: boolean
  message: string
  data: UserType[]
  total: number
  page: number
  page_size: number
  pages: number
}

const allRoles = [
  { id: 1, name: "SUPER_ADMIN" },
  { id: 2, name: "ADMIN" },
  { id: 3, name: "SUPERVISOR" },
  { id: 4, name: "USER" },
]

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN:
    "bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700",
  ADMIN:
    "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  SUPERVISOR:
    "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700",
  USER: "bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600",
}

const MIN_TRAINING_IMAGES = 10

const initialForm = {
  employee_id: "",
  name: "",
  email: "",
  password: "",
  role_id: 4,
  is_active: true,
  profile_image: "",
}

function Avatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const colors = [
    "bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300",
    "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300",
    "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300",
    "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300",
    "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300",
    "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/50 dark:text-cyan-300",
  ]
  const color = colors[name.charCodeAt(0) % colors.length]

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium ${color}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </div>
  )
}

export default function UserManagementPage() {
  const { user: currentUser } = useAuth()

  const [users, setUsers] = useState<UserType[]>([])
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)

  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserType | null>(null)
  const [form, setForm] = useState(initialForm)

  // ── image upload state ──────────────────────────────────────────────────────
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadTargetUser, setUploadTargetUser] = useState<UserType | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── train modal state ───────────────────────────────────────────────────────
  const [showTrainModal, setShowTrainModal] = useState(false)
  const [trainTargetUser, setTrainTargetUser] = useState<UserType | null>(null)
  const [trainLogs, setTrainLogs] = useState("")
  const [training, setTraining] = useState(false)
  const [trainDone, setTrainDone] = useState(false)
  const [trainSuccess, setTrainSuccess] = useState<boolean | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  // ── Role options filtered by the current user's role ───────────────────────
  // SUPER_ADMIN → all roles
  // ADMIN       → ADMIN, SUPERVISOR, USER  (cannot create SUPER_ADMIN)
  // Others      → no access to this page at all (guard elsewhere)
  const availableRoles = useMemo(() => {
    if (currentUser?.role_id === UserRole.SUPER_ADMIN) return allRoles
    if (currentUser?.role_id === UserRole.ADMIN)
      return allRoles.filter((r) => r.id !== UserRole.SUPER_ADMIN)
    return []
  }, [currentUser?.role_id])

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          u.employee_id.toLowerCase().includes(search.toLowerCase())
      ),
    [users, search]
  )

  async function fetchUsers() {
    try {
      setLoading(true)
      const res = await apiClient.get<PaginatedResponse>("/users", {
        params: { page, page_size: 20 },
      })
      setUsers(res.data.data || [])
      setPages(res.data.pages || 1)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [page])

  function openCreateModal() {
    setEditingUser(null)
    // Default role_id to the first available role for the current user
    setForm({ ...initialForm, role_id: availableRoles[0]?.id ?? 4 })
    setShowModal(true)
  }

  function openEditModal(user: UserType) {
    setEditingUser(user)
    setForm({
      employee_id: user.employee_id,
      name: user.name,
      email: user.email,
      password: "",
      role_id: user.role_id,
      is_active: user.is_active,
      profile_image: user.profile_image || "",
    })
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      setLoading(true)
      const payload: any = {
        employee_id: form.employee_id,
        name: form.name,
        email: form.email,
        role_id: form.role_id,
        is_active: form.is_active,
        profile_image: form.profile_image,
      }
      if (form.password) payload.password = form.password

      if (editingUser) {
        await apiClient.patch(`/users/${editingUser.id}`, payload)
      } else {
        await apiClient.post("/users", payload)
      }

      await fetchUsers()
      setShowModal(false)
      setEditingUser(null)
      setForm(initialForm)
    } catch (err) {
      console.error(err)
      alert("Operation failed")
    } finally {
      setLoading(false)
    }
  }

  // ── upload helpers ──────────────────────────────────────────────────────────
  function openUploadModal(user: UserType) {
    setUploadTargetUser(user)
    setSelectedFiles([])
    setPreviews([])
    setUploadError(null)
    setUploadSuccess(false)
    setShowUploadModal(true)
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const combined = [...selectedFiles, ...files]
    setSelectedFiles(combined)
    setPreviews(combined.map((f) => URL.createObjectURL(f)))
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function removePreview(idx: number) {
    const next = selectedFiles.filter((_, i) => i !== idx)
    setSelectedFiles(next)
    setPreviews(next.map((f) => URL.createObjectURL(f)))
  }

  async function handleImageUpload() {
    if (!uploadTargetUser) return
    if (selectedFiles.length < MIN_TRAINING_IMAGES) {
      setUploadError(
        `Please select at least ${MIN_TRAINING_IMAGES} images. You've selected ${selectedFiles.length}.`
      )
      return
    }
    try {
      setUploading(true)
      setUploadError(null)
      const formData = new FormData()
      selectedFiles.forEach((file) => formData.append("images", file))
      await apiClient.post(`/users/${uploadTargetUser.id}/images`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setUploadSuccess(true)
      await fetchUsers()
      setTimeout(() => {
        setShowUploadModal(false)
        setUploadTargetUser(null)
      }, 1500)
    } catch (err: any) {
      setUploadError(err?.response?.data?.detail || "Upload failed. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  // ── train helpers ───────────────────────────────────────────────────────────
  function openTrainModal(user: UserType) {
    setTrainTargetUser(user)
    setTrainLogs("")
    setTraining(false)
    setTrainDone(false)
    setTrainSuccess(null)
    setShowTrainModal(true)
  }

  async function startTraining() {
    if (!trainTargetUser) return
    setTraining(true)
    setTrainLogs("")
    setTrainDone(false)
    setTrainSuccess(null)
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/users/${trainTargetUser.id}/train`,
        { method: "POST", credentials: "include" }
      )
      if (!res.ok || !res.body) throw new Error("Training request failed")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullLog = ""
      let succeeded = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        fullLog += chunk
        setTrainLogs(fullLog)
        setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
        if (chunk.includes("[TRAINING COMPLETE]")) succeeded = true
      }

      setTrainSuccess(succeeded)
      setTrainDone(true)
      await apiClient.post(`/users/${trainTargetUser.id}/train/commit`)
      await fetchUsers()
    } catch (err: any) {
      setTrainLogs((prev) => prev + `\nError: ${err.message}`)
      setTrainSuccess(false)
      setTrainDone(true)
    } finally {
      setTraining(false)
    }
  }

  async function handleDelete(userId: number) {
    if (!confirm("Delete this user?")) return
    try {
      setLoading(true)
      await apiClient.delete(`/users/${userId}`)
      await fetchUsers()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // ── shared modal backdrop ───────────────────────────────────────────────────
  const Backdrop = ({ children }: { children: React.ReactNode }) => (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center">
      {children}
    </div>
  )

  const inputCls =
    "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-gray-500 dark:focus:ring-gray-700"

  const selectCls =
    "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100 appearance-none cursor-pointer dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-500 dark:focus:ring-gray-700"

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-8 dark:bg-gray-950">
      <div className="mx-auto max-w-6xl">

        {/* ── Page header ── */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Users</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Manage accounts, roles, and face training.</p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700 active:scale-95 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
          >
            <Plus size={16} />
            Add user
          </button>
        </div>

        {/* ── Search ── */}
        <div className="mb-4 relative max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search by name, email, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-gray-600 dark:focus:ring-gray-800"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* ── Table ── */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Training</th>
                  <th className="px-5 py-3">Zones</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-gray-400 dark:text-gray-600">
                      <Loader2 size={20} className="mx-auto animate-spin" />
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <User size={32} className="mx-auto mb-2 text-gray-200 dark:text-gray-700" />
                      <p className="text-sm text-gray-400 dark:text-gray-600">No users found</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors dark:hover:bg-gray-800/60">
                      {/* User */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={user.name} src={user.profile_image} size={36} />
                          <div>
                            <p className="font-medium text-gray-900 leading-tight dark:text-gray-100">{user.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5 dark:text-gray-500">{user.email}</p>
                            <p className="text-xs text-gray-300 font-mono dark:text-gray-600">{user.employee_id}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                            ROLE_COLORS[user.role?.name ?? "USER"]
                          }`}
                        >
                          <Shield size={11} />
                          {user.role?.name ?? "—"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                            user.is_active
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
                              : "bg-red-50 text-red-500 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              user.is_active ? "bg-emerald-500 dark:bg-emerald-400" : "bg-red-400"
                            }`}
                          />
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Training */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            user.is_trained
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-500 dark:text-amber-400"
                          }`}
                        >
                          {user.is_trained ? (
                            <CheckCircle2 size={13} />
                          ) : (
                            <Camera size={13} />
                          )}
                          {user.is_trained ? "Trained" : "Not trained"}
                        </span>
                      </td>

                      {/* Zones */}
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {user.zone_permissions?.length > 0 ? (
                            user.zone_permissions.map((z) => (
                              <span
                                key={z.id}
                                className="rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-600 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"
                              >
                                {z.zone?.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(user)}
                            title="Edit"
                            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => openUploadModal(user)}
                            title="Upload training images"
                            className="rounded-md p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors dark:text-gray-500 dark:hover:bg-blue-900/40 dark:hover:text-blue-400"
                          >
                            <Camera size={15} />
                          </button>
                          <button
                            onClick={() => openTrainModal(user)}
                            title="Train face model"
                            className="rounded-md p-1.5 text-gray-400 hover:bg-violet-50 hover:text-violet-600 transition-colors dark:text-gray-500 dark:hover:bg-violet-900/40 dark:hover:text-violet-400"
                          >
                            <Brain size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            title="Delete"
                            className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors dark:text-gray-500 dark:hover:bg-red-900/40 dark:hover:text-red-400"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-800">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Page <span className="font-medium text-gray-700 dark:text-gray-300">{page}</span> of{" "}
                <span className="font-medium text-gray-700 dark:text-gray-300">{pages}</span>
              </p>
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40 transition border border-transparent hover:border-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:border-gray-600"
                >
                  <ChevronLeft size={13} /> Prev
                </button>
                <button
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40 transition border border-transparent hover:border-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:border-gray-600"
                >
                  Next <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ CREATE / EDIT MODAL ═══════════════════════════════════════════════ */}
      {showModal && (
        <Backdrop>
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            {/* Header */}
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {editingUser ? "Edit user" : "Add user"}
                </h2>
                <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                  {editingUser ? `Editing ${editingUser.name}` : "Fill in the details below."}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Employee ID</label>
                  <input
                    type="text"
                    placeholder="EMP-001"
                    value={form.employee_id}
                    onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Full name</label>
                  <input
                    type="text"
                    placeholder="Jane Doe"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Email</label>
                <input
                  type="email"
                  placeholder="jane@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputCls}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  Password{" "}
                  {editingUser && (
                    <span className="font-normal text-gray-400 dark:text-gray-500">
                      (leave blank to keep current)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className={inputCls}
                  required={!editingUser}
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    Profile image URL{" "}
                    <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="https://…"
                    value={form.profile_image}
                    onChange={(e) => setForm({ ...form, profile_image: e.target.value })}
                    className={inputCls}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Role</label>
                  <div className="relative">
                    <select
                      value={form.role_id}
                      onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })}
                      className={selectCls}
                    >
                      {availableRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Status</label>
                  <div className="relative">
                    <select
                      value={String(form.is_active)}
                      onChange={(e) => setForm({ ...form, is_active: e.target.value === "true" })}
                      className={selectCls}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {editingUser ? "Save changes" : "Create user"}
                </button>
              </div>
            </form>
          </div>
        </Backdrop>
      )}

      {/* ═══ IMAGE UPLOAD MODAL ════════════════════════════════════════════════ */}
      {showUploadModal && uploadTargetUser && (
        <Backdrop>
          <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Avatar name={uploadTargetUser.name} src={uploadTargetUser.profile_image} size={32} />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Upload training images</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {uploadTargetUser.name} · {uploadTargetUser.employee_id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 transition dark:text-gray-500 dark:hover:bg-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Requirement note */}
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3.5 py-2.5 text-xs text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400">
                <ImagePlus size={14} className="shrink-0" />
                <span>
                  Minimum <strong>{MIN_TRAINING_IMAGES}</strong> images required.{" "}
                  <span
                    className={
                      selectedFiles.length >= MIN_TRAINING_IMAGES
                        ? "text-emerald-600 font-medium dark:text-emerald-400"
                        : ""
                    }
                  >
                    {selectedFiles.length} selected.
                  </span>
                </span>
              </div>

              {/* Drop zone */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-7 text-gray-400 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-500 active:scale-[0.99] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500 dark:hover:border-blue-700 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
              >
                <Upload size={22} />
                <span className="text-xs">Click to pick images — jpg, png, webp</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleFilePick}
              />

              {/* Previews */}
              {previews.length > 0 && (
                <div className="grid grid-cols-5 gap-2 max-h-52 overflow-y-auto rounded-lg">
                  {previews.map((src, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={src}
                        alt={`preview-${idx}`}
                        className="h-20 w-full rounded-lg object-cover border border-gray-100 dark:border-gray-700"
                      />
                      <button
                        type="button"
                        onClick={() => removePreview(idx)}
                        className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5 text-gray-500 opacity-0 group-hover:opacity-100 transition hover:bg-red-50 hover:text-red-500 border border-gray-200 dark:bg-gray-800/90 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-red-900/40 dark:hover:text-red-400"
                      >
                        <X size={10} />
                      </button>
                      <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[9px] font-medium text-white">
                        {idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Progress bar */}
              {selectedFiles.length > 0 && (
                <div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        selectedFiles.length >= MIN_TRAINING_IMAGES ? "bg-emerald-500" : "bg-blue-400"
                      }`}
                      style={{ width: `${Math.min(100, (selectedFiles.length / MIN_TRAINING_IMAGES) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Alerts */}
              {uploadError && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3.5 py-2.5 text-xs text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  {uploadError}
                </div>
              )}
              {uploadSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3.5 py-2.5 text-xs text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400">
                  <CheckCircle2 size={14} className="shrink-0" />
                  Images uploaded successfully!
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImageUpload}
                disabled={uploading || selectedFiles.length < MIN_TRAINING_IMAGES}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {uploading ? (
                  <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                ) : (
                  <><Upload size={14} /> Upload{" "}
                    {selectedFiles.length > 0
                      ? `${selectedFiles.length} image${selectedFiles.length !== 1 ? "s" : ""}`
                      : "images"}
                  </>
                )}
              </button>
            </div>
          </div>
        </Backdrop>
      )}

      {/* ═══ TRAIN MODAL ═══════════════════════════════════════════════════════ */}
      {showTrainModal && trainTargetUser && (
        <Backdrop>
          <div
            className="flex w-full max-w-2xl flex-col rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
            style={{ maxHeight: "88vh" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
                  <Brain size={16} className="text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Face training</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {trainTargetUser.name} · {trainTargetUser.employee_id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => !training && setShowTrainModal(false)}
                disabled={training}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 transition disabled:opacity-30 dark:text-gray-500 dark:hover:bg-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Status bar */}
            <div
              className={`flex items-center gap-2 px-5 py-2.5 text-xs font-medium transition-colors ${
                trainSuccess === true
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                  : trainSuccess === false
                  ? "bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400"
                  : training
                  ? "bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400"
                  : "bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
              }`}
            >
              {training && <Loader2 size={12} className="animate-spin" />}
              {trainSuccess === true && <CheckCircle2 size={12} />}
              {trainSuccess === false && <AlertCircle size={12} />}
              {!training && trainSuccess === null && <Terminal size={12} />}
              <span>
                {training
                  ? "Training in progress — this may take a few minutes"
                  : trainSuccess === true
                  ? "Training complete — embeddings saved"
                  : trainSuccess === false
                  ? "Training failed — see logs below"
                  : "Ready to start training"}
              </span>
            </div>

            {/* Terminal */}
            <div
              className="flex-1 overflow-y-auto bg-[#0d1117] px-5 py-4"
              style={{ minHeight: 240, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 12 }}
            >
              {trainLogs ? (
                <>
                  <pre className="whitespace-pre-wrap leading-relaxed text-emerald-400">{trainLogs}</pre>
                  <div ref={logEndRef} />
                </>
              ) : (
                <p className="text-gray-600">Logs will appear here once training starts…</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4 dark:border-gray-700">
              <p className="text-xs text-gray-400 font-mono dark:text-gray-500">
                models/2_augment_faces.py
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTrainModal(false)}
                  disabled={training}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-40 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={startTraining}
                  disabled={training || (trainDone && trainSuccess === true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-600"
                >
                  {training ? (
                    <><Loader2 size={14} className="animate-spin" /> Training…</>
                  ) : trainDone && trainSuccess ? (
                    <><CheckCircle2 size={14} /> Done</>
                  ) : (
                    <><Brain size={14} /> Start training</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Backdrop>
      )}
    </div>
  )
}
