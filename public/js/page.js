/* jshint browser:true, jquery:true */
'use strict';
$(function() {
  /*
  Update a user record. This function assumes the attribute inputs on the page go [name, email, age], and that
  they're of type email or text.
  After collecting the needed information, it sets all the inputs in the form to "disabled" until the response
  comes back. If there's an error, it attaches a new div containing the error text.
  */
  function updateUser(event) {
    event.preventDefault();
    var form = $(event.target),
        inputs = form.find('input[type="text"], input[type="email"]'),
        values = inputs.map(function() {return this.value;}),
        name = values[0],
        email = values[1],
        age = values[2];

    form.find('input').attr('disabled', true);

    $.ajax(form.attr('action'), {
      method: 'PATCH',
      data: {
        name: name,
        email: email,
        age: age
      },
      success: function() {
        form.parent('div').find('.error').remove();
        form.find('input').attr('disabled', false);
      }, error: function(response) {
        var errorMessage = $('<div class="error">');
        errorMessage.text(response.responseJSON.error);
        form.find('input').attr('disabled', false);
        form.parent('div').find('.error').remove();
        form.parent('div').prepend(errorMessage);
      }
    });
  }

  /*
  Given information about a user, create a new row for that user and insert it into the contact list.
  The large blob of $(html) calls could also look like:
  <div class="row">
    <form action="/api/people/{{index}}">
      <label for="name-{{index}}">Name:</label>
      <input type="text" name="name-{{index}}" id="name-{{index}}">
      <label for="email-{{index}}">Email:</label>
      <input type="email" name="email-{{index}}" id="email-{{index}}">
      <label for="age-{{index}}">Age:</label>
      <input type="text" name="age-{{index}}" id="age-{{index}}">
      <input type="submit" value="Update">
      <button>Delete</button>
    </form>
  </div>

  Submitting the form triggers the deleteUser function above. Clicking the "delete" button
  sends a DELETE request, and on success, removes the whole row.

  The newly-created row goes just above the "add new" row.
  */
  function appendContact(name, email, age, index) {
    var entry = $('<div class="row">'),
        form = $('<form action="/api/people/' + index + '">'),
        nameLabel = $('<label for="name-' + index + '">Name: </label>'),
        nameInput = $('<input type="text" name="name-' + index + '" id="name-' + index + '">'),
        emailLabel = $('<label for="email-' + index + '">Email: </label>'),
        emailInput = $('<input type="email" name="email-' + index + '" id="email-' + index + '">'),
        ageLabel = $('<label for="age-' + index + '">Age: </label>'),
        ageInput = $('<input type="text" name="age-' + index + '" id="age-' + index + '">'),
        updateButton = $('<input type="submit" value="Update">'),
        deleteButton = $('<button>Delete</button>');

    deleteButton.click(function(event) {
      event.preventDefault();
      $.ajax(form.attr('action'), {
        method: 'DELETE',
        success: function() {
          entry.remove();
        }
      });
    });

    nameInput.val(name);
    emailInput.val(email);
    ageInput.val(age);

    form.append(nameLabel, nameInput, emailLabel, emailInput, ageLabel, ageInput, updateButton, deleteButton);
    form.submit(updateUser);
    entry.append(form);

    $('.add-new').before(entry);
  }

  /*
  Submit event handler for the "add new contact" form. It gets the needed information from the form fields,
  then makes a POST request to create a new contact. When the response comes back with the new contact's id,
  pass all the gathered information, along with the new id, to appendContact.
  */
  $('.add-new form').submit(function(event) {
    event.preventDefault();
    var form = $(event.target),
        name = $('#name').val(),
        email = $('#email').val(),
        age = $('#age').val();
    form.attr('disabled', true);
    $.ajax('/api/people', {
      method: 'POST',
      data: {
        name: name,
        email: email,
        age: age
      },
      success: function(response) {
        appendContact(name, email, age, response.index);
        $('#name, #email, #age').val('');
        form.attr('disabled', false);
        $('.add-new').find('.error').remove();
      }, error: function(response) {
        var errorMessage = $('<div class="error">');
        errorMessage.text(response.responseJSON.error);
        $('.add-new').find('.error').remove();
        $('.add-new').prepend(errorMessage);
        form.attr('disabled', false);
      }
    });
  });

  /*
  On loading the page, fetch all the previously-created contacts.
  Pass them along to appendContact, filtering out nulls.
  We have to filter out nulls because of the crappy way the server-side code handles indexing.
  */
  $.ajax('/api/people', {
    method: 'GET',
    success: function(response) {
      response.forEach(function(contact, index) {
        if (contact !== null) {
          appendContact(contact.name, contact.email, contact.age, index);
        }
      });
    }
  });
});
