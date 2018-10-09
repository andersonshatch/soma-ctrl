pipeline {
  agent any
  stages {
    stage('git') {
      steps {
        git(url: 'https://github.com/andersonshatch/soma-ctrl.git', branch: 'master', changelog: true)
      }
    }
    stage('build') {
      steps {
        sh 'node index.js -l 3000'
      }
    }
  }
}