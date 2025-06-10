'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from './AuthProvider'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from './ui/button'
import { 
  Plus, 
  User, 
  LogOut, 
  LayoutDashboard, 
  Menu, 
  X, 
  Settings, 
  HelpCircle,
  BarChart3,
  Bell,
  Moon,
  Sun
} from 'lucide-react'

// Logo Component
interface LogoProps {
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'h-6 w-auto',
  md: 'h-8 w-auto', 
  lg: 'h-10 w-auto',
}

function Logo({ variant = 'light', size = 'md', className }: LogoProps) {
  return (
    <div className={`flex items-center ${className}`}>
      {variant === 'dark' ? (
        <img 
          src="/dropaccess_dark.svg" 
          alt="DropAccess" 
          className={sizeMap[size]}
        />
      ) : (
        <img 
          src="/dropaccess_light.svg" 
          alt="DropAccess" 
          className={sizeMap[size]}
        />
      )}
    </div>
  )
}

// Custom Dropdown Component
interface CustomDropdownProps {
  trigger: React.ReactNode
  children: React.ReactNode
}

function CustomDropdown({ trigger, children }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      {isOpen && (
        <div className="absolute right-0 top-10 w-56 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg z-50 py-1">
          <div onClick={() => setIsOpen(false)}>
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

interface DropdownItemProps {
  onClick: () => void
  children: React.ReactNode
  className?: string
}

function DropdownItem({ onClick, children, className = '' }: DropdownItemProps) {
  return (
    <Button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center transition-colors ${className}`}
    >
      {children}
    </Button>
  )
}

function DropdownSeparator() {
  return <div className="h-px bg-gray-200 dark:bg-gray-600 my-1" />
}

// Dark Mode Hook
function useDarkMode() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // Check localStorage and system preference on mount
    const savedTheme = localStorage.getItem('theme')
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && systemPrefersDark)
    setIsDark(shouldBeDark)
    
    if (shouldBeDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggleDarkMode = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    
    if (newIsDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  return { isDark, toggleDarkMode }
}

export function Navbar() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isDark, toggleDarkMode } = useDarkMode()

  // Navigation items for authenticated users
  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      description: 'Overview of your drops'
    },
    {
      name: 'Analytics',
      href: '/analytics',
      icon: BarChart3,
      description: 'View drop statistics'
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: Settings,
      description: 'Account preferences'
    }
  ]

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Close sidebar when route changes
  useEffect(() => {
    setIsSidebarOpen(false)
  }, [pathname])

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isSidebarOpen])

  return (
    <>
      {/* Top Navigation Bar - Full Width */}
      <div className="bg-white dark:bg-gray-900 fixed top-0 left-0 right-0 z-50 border-b border-gray-200 dark:border-gray-700">
        <nav className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left section */}
            <div className="flex items-center space-x-6">
              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSidebarOpen(true)}
                  className="lg:hidden"
                >
                  <Menu className="w-5 h-5" />
                </Button>
              )}
              
              <Link href={user ? "/dashboard" : "/"} className="flex items-center">
                <Logo 
                  variant={isDark ? 'dark' : 'light'} 
                  size="md" 
                  className="transition-transform hover:scale-105" 
                />
              </Link>

              {/* Desktop Navigation - Only show for authenticated users */}
              {user && (
                <div className="hidden lg:flex items-center space-x-1 ml-8">
                  {navigationItems.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <Link key={item.name} href={item.href}>
                        <Button
                          variant={isActive ? "secondary" : "ghost"}
                          size="sm"
                          className="flex items-center space-x-2"
                        >
                          <item.icon className="w-4 h-4" />
                          <span>{item.name}</span>
                        </Button>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Right section */}
            <div className="flex items-center space-x-3">
              {/* Dark Mode Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleDarkMode}
                className="w-9 h-9 p-0"
              >
                {isDark ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </Button>

              {user ? (
                <>
                  {/* Single Create Button 
                  <Link href="/drops/new">
                    <Button size="sm" className="font-medium">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Drop
                    </Button>
                  </Link>*/}

                  {/* Notifications - Desktop only */}
                  <Button variant="ghost" size="sm" className="hidden md:flex w-9 h-9 p-0">
                    <Bell className="w-4 h-4" />
                  </Button>

                  {/* User Menu */}
                  <CustomDropdown
                    trigger={
                      <Button variant="ghost" size="sm" className="flex items-center space-x-2 px-2">
                        <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <span className="hidden md:inline text-sm font-medium max-w-24 truncate">
                          {user.email?.split('@')[0]}
                        </span>
                      </Button>
                    }
                  >
                    <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.email?.split('@')[0]}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {user.email}
                      </p>
                    </div>
                    <DropdownItem onClick={() => router.push('/dashboard')}>
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Dashboard
                    </DropdownItem>
                    <DropdownItem onClick={() => router.push('/settings')}>
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </DropdownItem>
                    <DropdownItem onClick={() => router.push('/help')}>
                      <HelpCircle className="w-4 h-4 mr-2" />
                      Help & Support
                    </DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem onClick={handleSignOut} className="text-red-600">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownItem>
                  </CustomDropdown>
                </>
              ) : (
                <div className="flex items-center space-x-3">
                  <Link href="/auth">
                    <Button variant="ghost" size="sm">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/auth">
                    <Button size="sm" className="font-medium">
                      Get Started
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </nav>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
          
          {/* Sidebar */}
          <div className="fixed left-0 top-0 h-full w-80 bg-white dark:bg-gray-900 shadow-xl transform transition-transform duration-200 ease-out">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <Logo 
                variant={isDark ? 'dark' : 'light'} 
                size="sm" 
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* User Info */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {user?.email?.split('@')[0]}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {user?.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Create Drop Button - Mobile */}
            {/*<div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <Link href="/drops/new" className="block">
                <Button className="w-full font-medium">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Drop
                </Button>
              </Link>
            </div>}

            {/* Navigation Items */}
            <div className="p-4 space-y-2">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Sidebar Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
              {/* Dark Mode Toggle */}
              <Button
                onClick={toggleDarkMode}
                className="flex items-center space-x-3 w-full p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span className="text-sm">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
              </Button>
              
              <Button
                onClick={() => router.push('/help')}
                className="flex items-center space-x-3 w-full p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                <span className="text-sm">Help & Support</span>
              </Button>
              
              <Button
                onClick={handleSignOut}
                className="flex items-center space-x-3 w-full p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}