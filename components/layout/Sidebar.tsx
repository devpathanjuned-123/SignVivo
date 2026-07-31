"use client";

import React from 'react'
import Logo from '@/components/layout/Logo'
import SidebarItem from '@/components/layout/SidebarItem';
import CreateNewMenu from '@/components/layout/CreateNewMenu';

const Sidebar = () => {
  return (
    <div className='bg-gray-200 w-72 min-h-screen shadow-lg border-r border-gray-200 '>
      <aside>
        {/* LOGO */}
        <div className=''>
          <Logo />
          <CreateNewMenu />
          <SidebarItem
            href='/dashboard'
            title='Dashboard'

          />
          <SidebarItem
            href='/documents'
            title='Documents'
          />
        </div>
        {/* Navigation */}
        <nav className='flex-1 overflow-y-auto p-4'>

        </nav>
      </aside>
    </div>
  )
}

export default Sidebar

