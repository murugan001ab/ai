import type { TrendData, ViolationData, Camera, Stat, Alert } from './types/dashboard'

export type { TrendData, ViolationData, Camera, Stat, Alert }

export const stats: Stat[] = [
  { title: 'PPE Compliance', value: '94.6%', delta: '+2.1%', deltaType: 'up', color: 'text-green-400', bgColor: 'bg-green-400/10', icon: 'shield-check' },
  { title: 'Total Persons', value: '427', delta: '+34', deltaType: 'up', color: 'text-blue-400', bgColor: 'bg-blue-400/10', icon: 'users' },
  { title: 'PPE Violations', value: '23', delta: '-5', deltaType: 'down', color: 'text-red-400', bgColor: 'bg-red-400/10', icon: 'alert-triangle' },
  { title: 'Active Cameras', value: '12/14', delta: '85%', deltaType: 'up', color: 'text-purple-400', bgColor: 'bg-purple-400/10', icon: 'camera' },
  { title: 'Avg Idle Time', value: '8.4 min', delta: '-1.2m', deltaType: 'down', color: 'text-amber-400', bgColor: 'bg-amber-400/10', icon: 'clock' },
  { title: 'Shift Efficiency', value: '88.2%', delta: '+3.4%', deltaType: 'up', color: 'text-cyan-400', bgColor: 'bg-cyan-400/10', icon: 'trending-up' },
]

export const trendData: TrendData[] = [
  { day: '12 May', compliance: 88, idle: 14, violations: 31 },
  { day: '13 May', compliance: 89, idle: 13, violations: 28 },
  { day: '14 May', compliance: 87, idle: 15, violations: 33 },
  { day: '15 May', compliance: 91, idle: 11, violations: 25 },
  { day: '16 May', compliance: 90, idle: 12, violations: 27 },
  { day: '17 May', compliance: 92, idle: 10, violations: 22 },
  { day: '18 May', compliance: 91, idle: 10, violations: 24 },
  { day: '19 May', compliance: 92, idle: 9, violations: 21 },
  { day: '20 May', compliance: 94, idle: 11, violations: 19 },
  { day: '21 May', compliance: 93, idle: 10, violations: 22 },
  { day: '22 May', compliance: 95, idle: 8, violations: 18 },
  { day: '23 May', compliance: 94, idle: 9, violations: 20 },
  { day: '24 May', compliance: 96, idle: 7, violations: 15 },
  { day: '25 May', compliance: 94.6, idle: 8.4, violations: 23 },
]

export const violations: ViolationData[] = [
  { type: 'Helmet', count: 21, color: '#ef4444' },
  { type: 'Gloves', count: 14, color: '#f97316' },
  { type: 'Reflective Vest', count: 9, color: '#eab308' },
  { type: 'Safety Boots', count: 6, color: '#8b5cf6' },
  { type: 'Goggles', count: 4, color: '#3b82f6' },
]

export const alerts: Alert[] = [
  { id: 'a1', message: 'PPE Violation: No Helmet Detected', camera: 'CAM-03', severity: 'critical', timestamp: new Date(Date.now() - 1000 * 60 * 2), acknowledged: false },
  { id: 'a2', message: 'Unauthorized Person in Restricted Zone', camera: 'CAM-07', severity: 'critical', timestamp: new Date(Date.now() - 1000 * 60 * 8), acknowledged: false },
  { id: 'a3', message: 'Idle Time Exceeded 15 minutes', camera: 'CAM-02', severity: 'warning', timestamp: new Date(Date.now() - 1000 * 60 * 15), acknowledged: false },
  { id: 'a4', message: 'Missing Reflective Vest', camera: 'CAM-05', severity: 'warning', timestamp: new Date(Date.now() - 1000 * 60 * 22), acknowledged: true },
  { id: 'a5', message: 'Camera Feed Degraded (Low FPS)', camera: 'CAM-11', severity: 'info', timestamp: new Date(Date.now() - 1000 * 60 * 35), acknowledged: true },
]

export const cameras: Camera[] = [
  { id: 'cam-01', name: 'CAM-01', area: 'Main Workshop', image: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=800&auto=format&fit=crop', status: 'online', persons: 14, violations: 2, fps: 30 },
  { id: 'cam-02', name: 'CAM-02', area: 'Loading Bay', image: 'https://images.unsplash.com/photo-1565514020179-026b92b84bb6?q=80&w=800&auto=format&fit=crop', status: 'online', persons: 8, violations: 0, fps: 25 },
  { id: 'cam-03', name: 'CAM-03', area: 'Assembly Line A', image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?q=80&w=800&auto=format&fit=crop', status: 'warning', persons: 22, violations: 5, fps: 30 },
  { id: 'cam-04', name: 'CAM-04', area: 'Storage Room', image: 'https://images.unsplash.com/photo-1553413077-190dd305871c?q=80&w=800&auto=format&fit=crop', status: 'online', persons: 3, violations: 0, fps: 30 },
  { id: 'cam-05', name: 'CAM-05', area: 'Entrance Gate', image: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=800&auto=format&fit=crop', status: 'online', persons: 6, violations: 1, fps: 30 },
  { id: 'cam-06', name: 'CAM-06', area: 'Rooftop Zone', image: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?q=80&w=800&auto=format&fit=crop', status: 'offline', persons: 0, violations: 0, fps: 0 },
]
