export interface TrendData {
  day: string
  compliance: number
  idle: number
  violations: number
}

export interface ViolationData {
  type: string
  count: number
  color?: string
}

export interface Camera {
  id: string
  name: string
  area: string
  image: string
  status: 'online' | 'offline' | 'warning'
  persons: number
  violations: number
  fps: number
}

export interface Stat {
  title: string
  value: string
  delta?: string
  deltaType?: 'up' | 'down'
  color: string
  bgColor: string
  icon: string
}

export interface Alert {
  id: string
  message: string
  camera: string
  severity: 'critical' | 'warning' | 'info'
  timestamp: Date
  acknowledged: boolean
}
