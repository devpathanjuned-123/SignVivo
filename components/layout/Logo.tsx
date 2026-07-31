import React from 'react'
import Link from "next/link";


const Logo = () => {
    return (
        <>
            <Link href="/documents"
                className='flex items-center px-4 py-4'
            >
                <div className='font-bold flex justify-center items-center h-8 w-8 bg-blue-700 text-white rounded-xl '>
                    S
                </div>
                <div>
                    <h1 className='text-2xl font-bold p-2 '>SignVivo</h1>


                </div>
            </Link>
        </>
    )
}

export default Logo
