#include "spi.h"

#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/delay.h>

#define SPI_PORT    PORTB
#define SPI_DDR     DDRB
#define MISO_PIN    PINB4
#define MOSI_PIN    PINB3
#define SCK_PIN     PINB5
#define SS_PIN      PINB2

// Initialize pins for spi communication
void spi_init(){
   SPI_DDR &= ~(1<<MISO_PIN);
   // Define the following pins as output
   SPI_DDR |= ((1<<MOSI_PIN)|(1<<SS_PIN)|(1<<SCK_PIN));

   // Enable SPI as master = F_CPU/4 rate     
   SPCR = ((1<<SPE)|(1<<MSTR)|(0<<SPR1)|(0<<SPR0));

    
   // Bring the slave select high
   SPI_PORT |= (1 << SS_PIN);
    
}

// Do a spi transaction
void spi_transaction(char * dataout, char * datain, char length) {
   // Drop chip select pin low
   SPI_PORT &= ~(1 << SS_PIN);
   _delay_ms(1);
   for (int x = 0; x < length; x++) {
      SPDR = dataout[x];
      while((SPSR & (1 << SPIF)) == 0)
         ;
      datain[x] = SPDR;
   }
   SPI_PORT |= (1 << SS_PIN);
}

