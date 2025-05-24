const yup = require('yup');

module.exports = {
  validatePostUser,
  validatePostOrganization,
  validatePutUser,
  validatePutOrganization
};

const postOrgSchema = yup.object({
    name: yup.string().trim().required('Name is required'),
    description: yup.string().trim().required('Description is required')
});

const postUserSchema = yup.object({
    orgId: yup.string().trim().required('OrgId is required'),
    name: yup.string().trim().required('Name is required'),
    email: yup.string().email('Invalid email').trim().required('Email is required'),
});

const putOrgSchema = yup.object({
    orgId: yup.string().required("Organization Id is required"),
    name: yup.string().trim(),
    description: yup.string().trim()
});

const putUserSchema = yup.object({
    orgId: yup.string().trim().required('OrgId is required'),
    userId: yup.string().required('User ID is required'),
    name: yup.string().trim(),
    email: yup.string().email('Invalid email').trim()
});

function validatePostUser(user) {
    return validate(user, postUserSchema)
}

function validatePostOrganization(org){
    return validate(org, postOrgSchema)
}

function validatePutUser(user){
    return validate(user, putUserSchema)
}

function validatePutOrganization(org){
    return validate(org, putOrgSchema)
}

function validate(obj, schema){
    try {
        return schema.validateSync(obj, { abortEarly: false, strict: true })
    } catch (error) {
        return {
            errorMessage: error.errors.join(" ")
        };
    }
}