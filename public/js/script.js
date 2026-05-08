// Example starter JavaScript for disabling form submissions if there are invalid fields
(function () {
  'use strict'

  // Fetch all the forms we want to apply custom Bootstrap validation styles to
  var forms = document.querySelectorAll('.needs-validation')

  // Loop over them and prevent submission
  Array.prototype.slice.call(forms)
    .forEach(function (form) {
      form.addEventListener('submit', function (event) {
        if (!form.checkValidity()) {
          event.preventDefault()
          event.stopPropagation()
        }

        form.classList.add('was-validated')
      }, false)
    })
})()

document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
  button.addEventListener('click', function () {
    var root = document.documentElement
    var currentTheme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
    var nextTheme = currentTheme === 'dark' ? 'light' : 'dark'
    root.setAttribute('data-theme', nextTheme)
    localStorage.setItem('luxestay-theme', nextTheme)
  })
})

document.querySelectorAll('.listing-images-input').forEach(function (input) {
  input.addEventListener('change', function () {
    var targetId = input.getAttribute('data-preview-target')
    var previewContainer = targetId ? document.getElementById(targetId) : null

    if (!previewContainer) return

    previewContainer.innerHTML = ''

    Array.prototype.slice.call(input.files || []).slice(0, 6).forEach(function (file) {
      if (!file.type || !file.type.startsWith('image/')) return

      var reader = new FileReader()
      reader.onload = function (event) {
        var image = document.createElement('img')
        image.src = event.target.result
        image.alt = file.name
        image.className = 'edit-preview-img'
        previewContainer.appendChild(image)
      }
      reader.readAsDataURL(file)
    })
  })
})

document.querySelectorAll('.listing-gallery').forEach(function (gallery) {
  var mainImage = gallery.querySelector('[data-gallery-main]')
  var prevButton = gallery.querySelector('[data-gallery-prev]')
  var nextButton = gallery.querySelector('[data-gallery-next]')
  var thumbButtons = gallery.querySelectorAll('[data-gallery-thumb]')
  var images = []

  try {
    images = JSON.parse(gallery.getAttribute('data-gallery-images') || '[]')
  } catch (err) {
    images = []
  }

  var currentIndex = Number(gallery.getAttribute('data-gallery-index') || 0)
  if (!images.length || !mainImage) return

  function updateGalleryState() {
    gallery.classList.toggle('is-gallery-clean', currentIndex !== 0)
    thumbButtons.forEach(function (button) {
      button.classList.toggle('is-active', Number(button.getAttribute('data-gallery-thumb')) === currentIndex)
    })
  }

  function setImage(index) {
    if (index < 0) index = images.length - 1
    if (index >= images.length) index = 0
    if (index === currentIndex) return

    currentIndex = index
    gallery.setAttribute('data-gallery-index', currentIndex)
    updateGalleryState()
    mainImage.classList.remove('is-visible')

    window.setTimeout(function () {
      mainImage.src = images[currentIndex]
      mainImage.onload = function () {
        mainImage.classList.add('is-visible')
      }
      if (mainImage.complete) {
        mainImage.classList.add('is-visible')
      }
    }, 120)
  }

  updateGalleryState()

  var startTouchX = null
  gallery.addEventListener('touchstart', function (event) {
    startTouchX = event.touches[0].clientX
  }, { passive: true })

  gallery.addEventListener('touchend', function (event) {
    if (startTouchX === null) return
    var endX = event.changedTouches[0].clientX
    var diff = endX - startTouchX
    if (Math.abs(diff) > 45) {
      setImage(diff < 0 ? currentIndex + 1 : currentIndex - 1)
    }
    startTouchX = null
  }, { passive: true })

  if (images.length > 1) {
    window.setInterval(function () {
      setImage(currentIndex + 1)
    }, 6000)

    if (prevButton) {
      prevButton.addEventListener('click', function () {
        setImage(currentIndex - 1)
      })
    }

    if (nextButton) {
      nextButton.addEventListener('click', function () {
        setImage(currentIndex + 1)
      })
    }
  }

  thumbButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      setImage(Number(button.getAttribute('data-gallery-thumb')))
    })
  })
})

document.querySelectorAll('.listing-upload-form').forEach(function (form) {
  form.addEventListener('submit', function (event) {
    if (!form.checkValidity()) return

    event.preventDefault()

    var progressCard = form.querySelector('[data-upload-progress]')
    var progressBar = form.querySelector('[data-upload-bar]')
    var progressText = form.querySelector('[data-upload-text]')
    var submitButtons = form.querySelectorAll('button[type="submit"]')
    var formData = new FormData(form)
    var request = new XMLHttpRequest()

    if (progressCard) progressCard.classList.remove('d-none')
    if (progressBar) progressBar.style.width = '0%'
    if (progressText) progressText.textContent = '0%'

    submitButtons.forEach(function (button) {
      button.disabled = true
      button.dataset.originalText = button.textContent
      button.textContent = 'Uploading...'
    })

    request.open(form.method || 'POST', form.action)

    request.upload.addEventListener('progress', function (progressEvent) {
      if (!progressEvent.lengthComputable) return

      var percent = Math.min(100, Math.round((progressEvent.loaded / progressEvent.total) * 100))

      if (progressBar) progressBar.style.width = percent + '%'
      if (progressText) progressText.textContent = percent + '%'
    })

    request.addEventListener('load', function () {
      if (request.status >= 200 && request.status < 400) {
        if (progressBar) progressBar.style.width = '100%'
        if (progressText) progressText.textContent = '100%'
        window.location.href = request.responseURL || form.action
        return
      }

      submitButtons.forEach(function (button) {
        button.disabled = false
        button.textContent = button.dataset.originalText || 'Submit'
      })

      if (progressText) progressText.textContent = 'Upload failed'
    })

    request.addEventListener('error', function () {
      submitButtons.forEach(function (button) {
        button.disabled = false
        button.textContent = button.dataset.originalText || 'Submit'
      })

      if (progressText) progressText.textContent = 'Upload failed'
    })

    request.send(formData)
  })
})
