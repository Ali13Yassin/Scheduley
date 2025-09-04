#!/usr/bin/env python3
"""
Script to convert downloaded course data to template format.
Converts from 'Downloaded data.csv' to 'Template.csv' format.
"""

import csv
import os
import sys

def parse_time_slot(slot):
    """Parse time slot like '09:00-11:50' into start and end times."""
    if not slot or slot.strip() == '':
        return '', ''
    
    slot = slot.strip()
    if '-' in slot:
        parts = slot.split('-')
        if len(parts) >= 2:
            return parts[0].strip(), parts[1].strip()
        else:
            return slot, slot
    return slot, slot

def get_course_type(teaching_method):
    """Convert teaching method to type abbreviation."""
    method = teaching_method.upper().strip()
    if method == 'LEC':
        return 'LEC'
    elif method == 'LAB':
        return 'LAB'
    elif method == 'TUTORIALS':
        return 'TUT'
    else:
        return method

def convert_csv_data(input_file='Downloaded data.csv', output_file=None):
    """Convert downloaded data to template format."""
    
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"Error: Input file '{input_file}' not found.")
        return False
    
    # Generate output filename based on input filename if not provided
    if output_file is None:
        base_name = os.path.splitext(input_file)[0]  # Remove extension
        output_file = f"{base_name}_converted.csv"
    
    schedule_data = []
    course_info = {}
    
    try:
        # Read the downloaded data
        with open(input_file, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            
            for row in reader:
                # Skip rows with missing essential data
                if not row.get('Course Code', '').strip() or not row.get('Day', '').strip():
                    continue
                
                # Parse time slot
                start_time, end_time = parse_time_slot(row.get('Slot', ''))
                
                # Create schedule entry
                schedule_entry = {
                    'course': row.get('Course Code', '').strip(),
                    'class': row.get('Section', '').strip(),
                    'day': row.get('Day', '').strip(),
                    'start': start_time,
                    'end': end_time,
                    'location': row.get('Building/Room', '').strip(),
                    'lecturer': row.get('Staff Name', '').strip(),
                    'type': get_course_type(row.get('Teaching Method', ''))
                }
                schedule_data.append(schedule_entry)
                
                # Store unique course information
                course_code = row.get('Course Code', '').strip()
                if course_code and course_code not in course_info:
                    course_info[course_code] = {
                        'Course code': course_code,
                        'Course name': row.get('Course Name', '').strip(),
                        'Credit hours': '',  # Not available in source data
                        'Level': '',        # Not available in source data
                        'program': ''       # Not available in source data
                    }
        
        # Write to template format
        with open(output_file, 'w', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            
            # Write header
            header = ['course', 'class', 'day', 'start', 'end', 'location', 'lecturer', 'type', '', 
                     'Course code', 'Course name', 'Credit hours', 'Level', 'program']
            writer.writerow(header)
            
            # Determine the maximum number of rows needed
            max_schedule_rows = len(schedule_data)
            max_course_rows = len(course_info)
            max_rows = max(max_schedule_rows, max_course_rows)
            
            # Convert course_info dict to list for easier indexing
            course_list = list(course_info.values())
            
            # Write data rows
            for i in range(max_rows):
                row = ['', '', '', '', '', '', '', '', '']  # Initialize with empty values and separator
                
                # Add schedule data if available
                if i < len(schedule_data):
                    schedule = schedule_data[i]
                    row[0] = schedule['course']
                    row[1] = schedule['class']
                    row[2] = schedule['day']
                    row[3] = schedule['start']
                    row[4] = schedule['end']
                    row[5] = schedule['location']
                    row[6] = schedule['lecturer']
                    row[7] = schedule['type']
                
                # Add course info if available
                if i < len(course_list):
                    course = course_list[i]
                    row.extend([
                        course['Course code'],
                        course['Course name'],
                        course['Credit hours'],
                        course['Level'],
                        course['program']
                    ])
                else:
                    row.extend(['', '', '', '', ''])  # Empty course info
                
                writer.writerow(row)
        
        print(f"Successfully converted {len(schedule_data)} schedule entries and {len(course_info)} unique courses.")
        print(f"Output saved to '{output_file}'")
        return True
        
    except Exception as e:
        print(f"Error during conversion: {str(e)}")
        return False

def main():
    """Main function to run the conversion."""
    # Set the working directory to the script's directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    # Check if input file is provided as command line argument
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
        print(f"Converting {input_file} to template format...")
    else:
        input_file = 'Downloaded data.csv'
        print("Converting Downloaded data.csv to template format...")
    
    success = convert_csv_data(input_file)
    
    if success:
        print("\nConversion completed successfully!")
        print("\nNote: Credit hours, Level, and Program fields are empty as this information")
        print("is not available in the source data. You may need to fill these manually.")
    else:
        print("\nConversion failed. Please check the error messages above.")

if __name__ == "__main__":
    main()
