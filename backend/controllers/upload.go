package controllers

import (
	"backend/services"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

func UploadHandler(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, services.MaxUploadSize+(1<<20))
	file, header, err := c.Request.FormFile("attachment")
	if c.Request.MultipartForm != nil {
		defer c.Request.MultipartForm.RemoveAll()
	}
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "File must be 10 MB or smaller"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "A file attachment is required"})
		return
	}
	defer file.Close()
	result, err := services.UploadFile(file, header.Filename)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, services.ErrUploadTooLarge) {
			status = http.StatusRequestEntityTooLarge
		}
		if errors.Is(err, services.ErrUploadType) {
			status = http.StatusUnsupportedMediaType
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": result})
}
