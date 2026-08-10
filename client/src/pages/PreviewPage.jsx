import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom' 
import api from '../api/api'
import { AlertCircleIcon } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import Loading from '../components/Loading'
import FullPageReview from '../components/FullPageReview'

const PreviewPage = () => {
  const { id } = useParams()
  const {activeProject: project, loadingActiveProject: loading, loadProject} = useAppContext()

  useEffect(()=>{
    if(id){
    loadProject(id)
    }

  },[id])

  if (loading || !project) {
    return <Loading />
  }

  return (
     <FullPageReview files={project.files}/>
  )
}

export default PreviewPage