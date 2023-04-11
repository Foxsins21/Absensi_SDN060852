import { ref } from 'vue'
const Webcam = require('../helper/webcam')
const faceapi = require('../helper/faceApi.min.js')
import { savedUsers } from './useState'
import { useAlert } from './useNotification'
import { useRouter } from 'vue-router'

let snappedFace = ref().value

function loadLabeledImages() {
  if (savedUsers.length == 0) {
    useAlert().openAlert(
      'Wajah anda tidak terdaftar terdaftar!'
    )
    setTimeout(() => {
      window.location.href = '/'
    }, 1500)
  } else {
    return Promise.all(
      savedUsers.map(async (label) => {
        const descriptions = []
        for (let i = 1; i <= 2; i++) {
          const queryImage = new Image()
          queryImage.src = label.image
          const detections = await faceapi
            .detectSingleFace(queryImage)
            .withFaceLandmarks()
            .withFaceDescriptor()
          descriptions.push(detections.descriptor)
        }
        return new faceapi.LabeledFaceDescriptors(label.name, descriptions)
      })
    )
  }
}

const scanImg = async (router) => {

  const image = new Image()
  image.src = snappedFace

  const container = document.createElement('div')
  container.style.position = 'relative'
  document.body.append(container)
  const labeledFaceDescriptors = await loadLabeledImages(router)

  const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.4)

  const canvas = await faceapi.createCanvasFromMedia(image)
  document.body.append(canvas)
  const displaySize = { width: 350, height: 265 }

  faceapi.matchDimensions(canvas, displaySize)
  const detection = await faceapi
    .detectAllFaces(image)
    .withFaceLandmarks()
    .withFaceDescriptors()
  if (detection.length < 1) {
    location.reload()
  } else {
    const resizedDetections = faceapi.resizeResults(detection, displaySize)
    const results = resizedDetections.map((d) =>
      faceMatcher.findBestMatch(d.descriptor)
    )
    results.forEach((result, i) => {
      const box = resizedDetections[i].detection.box
      const drawBox = new faceapi.draw.DrawBox(box, {
        label: result.toString(),
      })
      drawBox.draw(canvas)
      savedUsers.map(async (label, index) => {
        if (label.name === result._label) {
          savedUsers[index].date.push(
            `${new Date().toLocaleTimeString()} of ${new Date().toLocaleDateString()}`
          )
          useAlert().openAlert(`${result._label}, Absen kamu berhasil terima kasih`)
          canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
          router.push('/')
        }
        else {
          canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
          useAlert().openAlert('User tidak di temukan')
          setTimeout(() => {
            window.location.href = '/'
          }, 1500)
        }
      })
    })
  }
}

export const SnapFace = () => {
  const router = useRouter()
  const video = document.querySelector('#video')
  let recog
  video.addEventListener('play', () => {
    const canvas = faceapi.createCanvasFromMedia(video)
    document.body.append(canvas)
    const displaySize = { width: video.width, height: video.height }
    faceapi.matchDimensions(canvas, displaySize)
    recog = setInterval(async () => {
      try {
        const detections = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceExpressions()
        const resizedDetections = faceapi.resizeResults(detections, displaySize)
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
        faceapi.draw.drawDetections(canvas, resizedDetections)
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)

        if (resizedDetections) {
          if (resizedDetections.detection.score.toFixed(2) > 0.7) {
            await clearInterval(recog)
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
            document.querySelector('#alert').style.color = 'green'
            document.querySelector('#alert').innerHTML = 'Face found'
            Webcam.snap(function (data_uri) {
              snappedFace = data_uri
            })
            await scanImg(router)
          } else {
            document.querySelector('#alert').style.color = 'red'
            document.querySelector('#alert').innerHTML =
              "Can't find a Face, Please Adjust"
          }
        }
      } catch (err) {
        console.log('something went wrong ====', err)
      }
    }, 1000)
  })
}