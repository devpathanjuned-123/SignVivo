"use client"

import React from 'react'
import Link from 'next/link'
import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

interface SidebarItemProps {
  href: string,
  title: string,
  icon?: ReactNode;
}

const SidebarItem = ({ href, title, icon }: SidebarItemProps) => {
  const pathname = usePathname();
  console.log("pathname:", pathname);
  console.log("href:", href);
  const active = pathname === href
  return (
    <>
      <div className='flex  items-center justify-start ml-5 mt-5 '>
        <Link href={href}
          className={`flex  gap-3 rounded-lg px-4 py-3 mt-2c active:scale-95 transition-all duration-300 ease-in-out ${active

            ? "bg-blue-100 text-black" : "text-gray-700 hover:bg-gray-100"
            }`}
        >
          {icon}
          <span>{title}</span>

        </Link>
      </div>
    </>
  )
}

export default SidebarItem
