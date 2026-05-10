package v1

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/mrbelka12000/hz_zachem/internal/delivery/http/middleware"
	"github.com/mrbelka12000/hz_zachem/internal/service"
)

const maxCSVUploadBytes = 10 << 20 // 10 MiB

// POST /v1/imports/csv
//   - multipart/form-data
//   - file:        CSV with header `Date,Amount,Name,Type`
//   - account_id:  UUID of the destination account
func (r *Router) importCSV(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	uid := middleware.MustUserID(c)

	if err := c.Request.ParseMultipartForm(maxCSVUploadBytes); err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}

	accountIDStr := c.PostForm("account_id")
	accountID, err := uuid.Parse(accountIDStr)
	if err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	if fileHeader.Size <= 0 || fileHeader.Size > maxCSVUploadBytes {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	defer file.Close()

	summary, err := r.svc.Imports.ImportCSV(c.Request.Context(), service.ImportCSVInput{
		HouseholdID: hid,
		AccountID:   accountID,
		CreatedBy:   uid,
		Reader:      file,
	})
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	created(c, summary)
}
